import { submodule } from '../src/hook.js';
import { logError, isStr, logMessage, isPlainObject, isEmpty, isFn } from '../src/utils.js';
import { config as conf } from '../src/config.js';
import { REGEX_BROWSERS, BROWSER_MAPPING } from '../src/constants.js';
import { getDeviceType as fetchDeviceType, getOS } from '../libraries/userAgentUtils/index.js';

/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

/**
 * This RTD module has a dependency on the priceFloors module.
 * We utilize the continueAuction function from the priceFloors module to incorporate price floors data into the current auction.
 */
import { continueAuction } from './priceFloors.js'; // eslint-disable-line prebid/validate-imports

const CONSTANTS = Object.freeze({
  SUBMODULE_NAME: 'pubmatic',
  REAL_TIME_MODULE: 'realTimeData',
  LOG_PRE_FIX: 'PubMatic-Rtd-Provider: ',
  UTM: 'utm_',
  UTM_VALUES: {
    TRUE: '1',
    FALSE: '0'
  },
  TIME_OF_DAY_VALUES: {
    MORNING: 'morning',
    AFTERNOON: 'afternoon',
    EVENING: 'evening',
    NIGHT: 'night',
  },
  ENDPOINTS: {
    FLOORS_BASEURL: `https://ads.pubmatic.com/AdServer/js/pwt/floors/`,
    FLOORS_ENDPOINT: `/floors.json`,
  }
});

let _pubmaticFloorRulesPromise = null;

// Utility Functions
export const getCurrentTimeOfDay = () => {
  const currentHour = new Date().getHours();

  return currentHour < 5 ? CONSTANTS.TIME_OF_DAY_VALUES.NIGHT
    : currentHour < 12 ? CONSTANTS.TIME_OF_DAY_VALUES.MORNING
      : currentHour < 17 ? CONSTANTS.TIME_OF_DAY_VALUES.AFTERNOON
        : currentHour < 19 ? CONSTANTS.TIME_OF_DAY_VALUES.EVENING
          : CONSTANTS.TIME_OF_DAY_VALUES.NIGHT;
}

export const getBrowserType = () => {
  const userAgent = navigator.userAgent;
  let browserName = userAgent == null ? -1 : 0;

  if (userAgent) {
    browserName = BROWSER_MAPPING[(REGEX_BROWSERS.findIndex(regex => userAgent.match(regex)))] || 0;
  }
  return browserName.toString();
}

// Getter Functions

export const getOs = () => getOS().toString();

export const getDeviceType = () => fetchDeviceType().toString();

export const getUtm = () => {
  const url = new URL(window.location?.href);
  const urlParams = new URLSearchParams(url?.search);
  return urlParams && urlParams.toString().includes(CONSTANTS.UTM) ? CONSTANTS.UTM_VALUES.TRUE : CONSTANTS.UTM_VALUES.FALSE;
}

export const getFloorsConfig = (apiResponse) => {
  let defaultFloorConfig = conf.getConfig()?.floors ?? {};
  defaultFloorConfig.data = { ...apiResponse };

  const floorsConfig = {
    floors: {
      additionalSchemaFields: {
        deviceType: getDeviceType,
        timeOfDay: getCurrentTimeOfDay,
        browser: getBrowserType,
        os: getOs,
        utm: getUtm
      },
      ...defaultFloorConfig
    },
  };

  return floorsConfig;
};

export const setFloorsConfig = (data) => {
  if (data && isPlainObject(data) && !isEmpty(data)) {
    conf.setConfig(getFloorsConfig(data));
  } else {
    logMessage(CONSTANTS.LOG_PRE_FIX + 'The fetched floors data is empty.');
  }
};

export const setPriceFloors = async (publisherId, profileId) => {
    const apiResponse = await fetchFloorRules(publisherId, profileId);

    if (!apiResponse) {
      logError(CONSTANTS.LOG_PRE_FIX + 'Error while fetching floors: Empty response');
    } else {
      setFloorsConfig(apiResponse);
    }
};

export const fetchFloorRules = async (publisherId, profileId) => {
  try {
    const url = `${CONSTANTS.ENDPOINTS.FLOORS_BASEURL}${publisherId}/${profileId}${CONSTANTS.ENDPOINTS.FLOORS_ENDPOINT}`;
   
    const response = await fetch(url);
    if (!response?.ok ) {
      logError(CONSTANTS.LOG_PRE_FIX + 'Error while fetching floors: No response');
    }

    const data = await response.json();
    return data; 
  } 
  catch (error) {
    logError(CONSTANTS.LOG_PRE_FIX + 'Error while fetching floors:', error);
  }
}

/**
 * Initialize the Pubmatic RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
const init = (config, _userConsent) => {
  const publisherId = config?.params?.publisherId;
  const profileId = config?.params?.profileId;

  if (!publisherId || !isStr(publisherId) || !profileId || !isStr(profileId)) {
    logError(
      `${CONSTANTS.LOG_PRE_FIX} ${!publisherId ? 'Missing publisher Id.'
        : !isStr(publisherId) ? 'Publisher Id should be a string.'
          : !profileId ? 'Missing profile Id.'
            : 'Profile Id should be a string.'
      }`
    );
    return false;
  }

  if (!isFn(continueAuction)) { 
    logError(`${CONSTANTS.LOG_PRE_FIX} continueAuction is not a function. Please ensure to add priceFloors module.`);
    return false;
  }

  _pubmaticFloorRulesPromise = setPriceFloors(publisherId, profileId);
  return true;
}

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */

const getBidRequestData = (reqBidsConfigObj, onDone) => {
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
  }).catch((error) => {
    logError(CONSTANTS.LOG_PRE_FIX, 'Error in updating floors :', error);
  });
}

/** @type {RtdSubmodule} */
export const pubmaticSubmodule = {
  /**
   * used to link submodule with realTimeData
   * @type {string}
   */
  name: CONSTANTS.SUBMODULE_NAME,
  init,
  getBidRequestData,
};

export const registerSubModule = () => {
  submodule(CONSTANTS.REAL_TIME_MODULE, pubmaticSubmodule);
}

registerSubModule();
