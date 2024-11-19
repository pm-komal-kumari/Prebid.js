import { submodule } from '../src/hook.js';
import { logInfo, logError, mergeDeep, isStr, deepAccess } from '../src/utils.js';
import { getGlobal } from '../src/prebidGlobal.js';
import {config as conf} from '../src/config.js';
import { ajax } from '../src/ajax.js';

/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

/**
 * This RTD module has a dependency on the priceFloors module.
 * We utilize the createFloorsDataForAuction function from the priceFloors module to incorporate price floors data into the current auction.
 */
import { createFloorsDataForAuction } from './priceFloors.js'; 

const BIDDER_CODE = 'pubmatic';
const REAL_TIME_MODULE = 'realTimeData';
const SUBMODULE_NAME = 'pubmatic';
const LOG_PRE_FIX = 'PubMatic-Rtd-Provider: ';
let isFloorEnabled = true; //default true
//let timeOfDay = 'evening';
//let deviceType = 'mobile';
window.__pubmaticFloorRulesPromise__ = null;
export const FloorsApiStatus = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});

export const FLOORS_EVENT_HANDLE = 'floorsApi';
export const FLOOR_PROVIDER = 'Pubmatic';

function getDeviceTypeFromUserAgent(userAgent) {
  // Normalize user agent string to lowercase for easier matching
  const ua = userAgent.toLowerCase();
  // Check for mobile devices
  if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone/.test(ua)) {
    return 'mobile';
  }
  // Check for tablets
  if (/tablet|ipad|android(?!.*mobile)/.test(ua)) {
    return 'tablet';
  }
  // Default to desktop if neither mobile nor tablet matches
  return 'desktop';
}
function getDeviceType() {
 // console.log(' In getDeviceType fn -> deviceType ->', deviceType);
 
  let deviceType = getDeviceTypeFromUserAgent(navigator.userAgent);
  if(deviceType == 'mobile')
      return 'mobile'
  else if (deviceType == 'tablet')
      return 'tablet'
  else if (deviceType == 'desktop')
      return 'desktop'
}

function getTimeOfDay(){
//  console.log(' In getTimeOfDay fn -> timeOfDay ->', timeOfDay);

  const currentHour = new Date().getHours();  // Get the current hour (0-23)

  if (currentHour >= 5 && currentHour < 12) {
    return 'morning';
  } else if (currentHour >= 12 && currentHour < 17) {
    return 'afternoon';
  } else if (currentHour >= 17 && currentHour < 19) {
    return 'evening';
  } else {
    return 'night';
  }
}

function executeDynamicFloors(apiResponse = {}) {
  const globalConfig = conf.getConfig();

  conf.mergeConfig({
      floors: {
        enforcement: {
          enforceJS: true
      },
      auctionDelay: 500,
      endpoint:{
          url: './floors.json'
      },
      data : {
          default : 0.23,
      },
      additionalSchemaFields: {
        deviceType : getDeviceType,
        timeOfDay: getTimeOfDay
      }
    }
    });
}

export const getFloorsConfig = (provider, apiResponse) => {
  const floorsConfig = {
    floors: {
      auctionDelay: 500,
      enforcement: { floorDeals: true },
      data: apiResponse,
      additionalSchemaFields: {
        deviceType : getDeviceType,
        timeOfDay: getTimeOfDay
      }
    },
  };
  const { floorMin, enforcement } = deepAccess(provider, 'params');
  if (floorMin) {
    floorsConfig.floors.floorMin = floorMin;
  }
  if (enforcement) {
    floorsConfig.floors.enforcement = enforcement;
  }
  return floorsConfig;
};

export const setFloorsConfig = (provider, data) => {
  if (data) {
    const floorsConfig = getFloorsConfig(provider, data);
    console.log('In pubmaticRTDProvider -> In setFloorsConfig -> floors data -> ',floorsConfig);
    conf.setConfig(floorsConfig);
    window.__pubmaticLoaded__ = true;
    window.__pubmaticFloorsConfig__ = floorsConfig;
  } else {
    conf.setConfig({ floors: window.__pubmaticPrevFloorsConfig__ });
    window.__pubmaticLoaded__ = false;
    window.__pubmaticFloorsConfig__ = null;
  }
};

export const setDefaultPriceFloors = (provider) => {
  const { data } = deepAccess(provider, 'params');
  if (data !== undefined) {
    data.floorProvider = FLOOR_PROVIDER;
    setFloorsConfig(provider, data);
  }
};

const setPriceFloors = async (config) => {
  window.__pubxPrevFloorsConfig__ = conf.getConfig('floors');
  //setDefaultPriceFloors(config); //Setting default floors before API call 
  return fetchFloorRules(config)
    .then((apiResponse) => {
      console.log('Pubmatic rtd provider -> In setPriceFloors fn -> after fetchFloorRules');
      setFloorsConfig(config, apiResponse);
      console.log('Pubmatic rtd provider -> In setPriceFloors fn -> after setFloorsConfig -> config.getConfig() -> ',conf.getConfig());
      setFloorsApiStatus(FloorsApiStatus.SUCCESS);
    })
    .catch((_) => {
      setFloorsApiStatus(FloorsApiStatus.ERROR);
    });
};

export const setFloorsApiStatus = (status) => {
  window.__pubmaticFloorsApiStatus__ = status;
  window.dispatchEvent(
    new CustomEvent(FLOORS_EVENT_HANDLE, { detail: { status } })
  );
};

const fetchFloorRules = async (config) => {
  console.log('Pubmatic rtd provider -> In fetchFloorRules fn -> before API call');

  return new Promise((resolve, reject) => {
    const url = 'https://hbopenbid.pubmatic.com/pubmaticRtdApi';
    if (url) {
      ajax(url, {
        success: (responseText, response) => {
          try {
            if (response && response.response) {
              console.log('API Response Timer: In Pubmatic RTD module -> ', Date.now());

              const apiResponse = JSON.parse(response.response);
              console.log('Pubmatic rtd provider -> In fetchFloorRules fn -> response', apiResponse);
              // timeOfDay = apiResponse.timeOfDay;
              // deviceType = apiResponse.deviceType;
              resolve(apiResponse);
            } else {
              resolve(null);
            }
          } catch (error) {
            reject(error);
          }
        },
        error: (responseText, response) => {
          reject(response);
        },
      });
    }
  });
};

/**
 * Initialize the Adagio RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
function init(config, _userConsent) {  
  console.log('Init fn Timer : In Pubmatic RTD module -> ', Date.now());
  const publisherId = config.params?.publisherId;
  const profileId = config.params?.profileId;

  if (!publisherId) {
    logError(LOG_PRE_FIX + 'Missing publisher Id.');
    return false;
  }

  if (publisherId && !isStr(publisherId)) {
    logError(LOG_PRE_FIX + 'Publisher Id should be string.');
    return false;
  }

  if (!profileId) {
    logError(LOG_PRE_FIX + 'Missing profile Id.');
    return false;
  }

  if (profileId && !isStr(profileId)) {
    logError(LOG_PRE_FIX + 'Profile Id should be string.');
    return false;
  }

  console.log('Pubmatic rtd provider -> In init fn')
  window.__pubmaticFloorRulesPromise__ = setPriceFloors(config);
  console.log('Pubmatic rtd provider -> In init fn -> window.__pubmaticFloorRulesPromise__', window.__pubmaticFloorRulesPromise__);
  return true;
}

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */

const getBidRequestData = (() => {
  console.log('Pubmatic rtd provider -> In getBidRequestData fn -> is floorAttached ->', floorsAttached);
  let floorsAttached = false;
  return (reqBidsConfigObj, onDone) => {
    if (!floorsAttached) {
    console.log('Pubmatic rtd provider -> In getBidRequestData fn -> inside if (!floorsAttached)');
      createFloorsDataForAuction(
        reqBidsConfigObj.adUnits,
        reqBidsConfigObj.auctionId
      );
      console.log('Pubmatic rtd provider -> In getBidRequestData fn -> inside if (!floorsAttached) -> config.getConfig() -> ',conf.getConfig())
      window.__pubmaticFloorRulesPromise__.then(() => {
        console.log('ubmatic rtd provider -> In getBidRequestData fn -> reqBidsConfigObj', reqBidsConfigObj);
        createFloorsDataForAuction(
          reqBidsConfigObj.adUnits,
          reqBidsConfigObj.auctionId
        );
        console.log('Pubmatic rtd provider -> Inside getBidRequestData fn -> window.__pubmaticFloorRulesPromise__', window.__pubmaticFloorRulesPromise__);
       
        //set ortb.bidders
        if(isFloorEnabled){
          const Ortb2 = {
            user : {
              ext : {
                name : 'komal',
                deviceType : getDeviceType(),
                timeOfDay : getTimeOfDay()
              }
            }
          }
      
          mergeDeep(reqBidsConfigObj.ortb2Fragments.bidder, {
            [BIDDER_CODE] : Ortb2
          });
        }
        onDone();
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
    name: SUBMODULE_NAME,
    init: init,
    getBidRequestData,
  };
  
  function registerSubModule() {
    submodule(REAL_TIME_MODULE, pubmaticSubmodule);
  }
  
  registerSubModule();