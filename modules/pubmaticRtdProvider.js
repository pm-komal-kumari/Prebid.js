import { submodule } from '../src/hook.js';
import { logError, isStr, logMessage } from '../src/utils.js';
import {config as conf} from '../src/config.js';
import { ajax } from '../src/ajax.js';
import { REGEX_BROWSERS, BROWSER_MAPPING } from '../src/constants.js';
import { getDeviceType as fetchDeviceType, getOS } from '../libraries/userAgentUtils/index.js';

/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

/**
 * This RTD module has a dependency on the priceFloors module.
 * We utilize the continueAuction function from the priceFloors module to incorporate price floors data into the current auction.
 */
import { continueAuction } from './priceFloors.js';

const CONSTANTS = Object.freeze({
  SUBMODULE_NAME: 'pubmatic',
  REAL_TIME_MODULE: 'realTimeData',
  LOG_PRE_FIX: 'PubMatic-Rtd-Provider: ',
  UTM: 'utm',
  UTM_VALUES : {
    TRUE : '1',
    FALSE : '0'
  },
  TIME_OF_DAY_VALUES: {
    MORNING: 'morning',
    AFTERNOON: 'afternoon',
    EVENING: 'evening',
    NIGHT: 'night',
  },
});

const ENDPOINTS = Object.freeze({
  FLOORS_BASEURL: `https://ads.pubmatic.com/AdServer/js/pwt/floors/`,
  FLOORS_ENDPOINT: `/floors.json`,
});

let _timeOfDay;
let _deviceType;
let _browser;
let _os;
let _utm;

let _pubmaticFloorRulesPromise = null;

//Utility Functions
export function getCurrentTimeOfDay() {
  const currentHour = new Date().getHours();

  if (currentHour >= 5 && currentHour < 12) {
    return CONSTANTS.TIME_OF_DAY_VALUES.MORNING;
  } else if (currentHour >= 12 && currentHour < 17) {
    return CONSTANTS.TIME_OF_DAY_VALUES.AFTERNOON;
  } else if (currentHour >= 17 && currentHour < 19) {
    return CONSTANTS.TIME_OF_DAY_VALUES.EVENING;
  } else {
    return CONSTANTS.TIME_OF_DAY_VALUES.NIGHT;
  }
}

export function getBrowserType() {
	const userAgent = navigator.userAgent;
	let browserName = userAgent == null ? -1 : 0;

	if(userAgent) {
		for(var i = 0; i < REGEX_BROWSERS.length; i++) {
			if(userAgent.match(REGEX_BROWSERS[i])) {
				browserName = BROWSER_MAPPING[i];
				break;
			}
		}
	}
	return browserName;
}

//Getter-Setter Functions
export function getBrowser() {
  return _browser;
}

export function setBrowser() {
  let browser = getBrowserType().toString();
  _browser = browser;
}

export function getOs() {
  return _os;
}

export function setOs() {
  let os = getOS().toString();
  _os = os;
}

export function getDeviceType() {
  return _deviceType;
}

export function setDeviceType() {
  let deviceType = fetchDeviceType().toString();
  _deviceType = deviceType;
}

export function getTimeOfDay() {
  return _timeOfDay;
}

export function setTimeOfDay() {
  let timeOfDay = getCurrentTimeOfDay();
  _timeOfDay = timeOfDay;
}

export function getUtm() {
  return _utm;
}

export function setUtm(url) {
  const queryString = url?.split('?')[1];
  _utm = queryString?.includes(CONSTANTS.UTM) ? CONSTANTS.UTM_VALUES.TRUE : CONSTANTS.UTM_VALUES.FALSE;
}

export const getFloorsConfig = (apiResponse) => {
  const floorsConfig = {
    floors: {
      data : {
        ...apiResponse
      },
      additionalSchemaFields: {
        deviceType: getDeviceType,
        timeOfDay: getTimeOfDay,
        browser: getBrowser,
        os: getOs,
        utm: getUtm
      }
    },
  };

  return floorsConfig;
};

export const setFloorsConfig = (data) => {
  if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
    const floorsConfig = getFloorsConfig(data);
    conf.mergeConfig(floorsConfig);
  }else{
    logMessage(CONSTANTS.LOG_PRE_FIX + 'The fetched floors data is empty.');
  }
};

export const setPriceFloors = async (publisherId, profileId) => {
  try {
    const apiResponse = await fetchFloorRules(publisherId, profileId);
    if (!apiResponse) {
      logError(CONSTANTS.LOG_PRE_FIX + 'Error while fetching floors: Empty response');
    }else{
      setFloorsConfig(apiResponse);
    }
  } catch (error) {
    logError(CONSTANTS.LOG_PRE_FIX + 'Error while fetching floors:', error);
  }
};

export const fetchFloorRules = async (publisherId, profileId) => {
  return new Promise((resolve, reject) => {
    const url = `${ENDPOINTS.FLOORS_BASEURL}${publisherId}/${profileId}${ENDPOINTS.FLOORS_ENDPOINT}`;
  
    ajax(url, {
      success: (responseText, response) => {
        try {
          if (!response || !response.response) {
            reject(new Error(CONSTANTS.LOG_PRE_FIX + ' Empty response'));
            return;
          }

          const apiResponse = JSON.parse(response.response);
          resolve(apiResponse);
        } catch (error) {
          reject(new SyntaxError(CONSTANTS.LOG_PRE_FIX + ' JSON parsing error: ' + error.message));
        }
      },
      error: (error) => {
        reject(new Error(CONSTANTS.LOG_PRE_FIX + 'Ajax error: ' + error));
      },
    });
  });
};

/**
 * Initialize the Pubmatic RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
function init(config, _userConsent) {
  const publisherId = config?.params?.publisherId;
  const profileId = config?.params?.profileId;

  if (!publisherId || !isStr(publisherId)) {
    logError(CONSTANTS.LOG_PRE_FIX + (!publisherId
    ? 'Missing publisher Id.'
    : 'Publisher Id should be a string.'));
    return false;
    }

  if (!profileId || !isStr(profileId)) {
    logError(CONSTANTS.LOG_PRE_FIX + (!profileId
    ? 'Missing profile Id.'
    : 'Profile Id should be string.'));
    return false;
    }  

  _pubmaticFloorRulesPromise = setPriceFloors(publisherId, profileId);
  setBrowser();
  setOs();
  setTimeOfDay();
  setDeviceType();
  setUtm(window.location?.href);
  return true;
}

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */

const getBidRequestData = (() => {
  let floorsAttached = false;
  return (reqBidsConfigObj, onDone) => {
    if (!floorsAttached) {
      _pubmaticFloorRulesPromise.then(() => {
        const hookConfig = {
          reqBidsConfigObj,
          context: this,
          nextFn: () => true,
          haveExited: false,
          timer: null
        };
        continueAuction(hookConfig);
        onDone();
      })
      .catch((error) => {
        logError(CONSTANTS.LOG_PRE_FIX, 'Error in updating floors :', error);
      });

      floorsAttached = true;
    }
  };
})();

/** @type {RtdSubmodule} */
export const pubmaticSubmodule = {
  /**
   * used to link submodule with realTimeData
   * @type {string}
   */
  name: CONSTANTS.SUBMODULE_NAME,
  init: init,
  getBidRequestData,
};

export function registerSubModule() {
  submodule(CONSTANTS.REAL_TIME_MODULE, pubmaticSubmodule);
}

registerSubModule();
