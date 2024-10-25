import { submodule } from '../src/hook.js';
import { logInfo, logError, mergeDeep, isEmptyStr } from '../src/utils.js';
import { getGlobal } from '../src/prebidGlobal.js';
import {config as conf} from '../src/config.js';

/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

const REAL_TIME_MODULE = 'realTimeData';
const SUBMODULE_NAME = 'pubmatic';
const LOG_PRE_FIX = 'PubMatic-Rtd-Provider: ';
let calculatedTimeOfDay = 'morning';

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
function deviceTypes() {
  let deviceType = getDeviceTypeFromUserAgent(navigator.userAgent);
  console.log('Pubmatic rtd provider -> In deviceType fn -> deviceType -> ',deviceType);
  if(deviceType == 'mobile')
      return 'mobile'
  else if (deviceType == 'tablet')
      return 'tablet'
  else if (deviceType == 'desktop')
      return 'desktop'
}

function timeOfDay(){
  return calculatedTimeOfDay;
}

function calculateTimeOfDay() {
  const currentHour = new Date().getHours();  // Get the current hour (0-23)

  if (currentHour >= 5 && currentHour < 12) {
    calculatedTimeOfDay = 'morning';
  } else if (currentHour >= 12 && currentHour < 17) {
    calculatedTimeOfDay = 'afternoon';
  } else if (currentHour >= 17 && currentHour < 19) {
    calculatedTimeOfDay = 'evening';
  } else {
    calculatedTimeOfDay = 'night';
  }
}

/**
 * Initialize the Adagio RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
function init(config, _userConsent) {  
  const publisherId = config.params?.publisherId;
  const profileId = config.params?.profileId;

  if (publisherId || isEmptyStr(publisherId)) {
    logError(LOG_PRE_FIX + 'Missing publisherId.');
    return false;
  }

  if (profileId || isEmptyStr(profileId)) {
    logError(LOG_PRE_FIX + 'Missing profileId.');
    return false;
  }

  calculateTimeOfDay();
  const globalConfig = conf.getConfig();
  console.log('Pubmatic rtd provider -> In init fn -> globalConfig.floors -> ', globalConfig.floors);
 
  conf.mergeConfig({
      floors: {
        additionalSchemaFields: {
          deviceType : deviceTypes,
          timeOfDay: timeOfDay
        }
      }
    });
    return true;
}

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */
function getBidRequestData(reqBidsConfigObj, callback, config, userConsent) {
  console.log('Pubmatic rtd provider -> In getBidRequestData fn -> reqBidsConfigObj', reqBidsConfigObj);

  const Ortb2 = {
    user : {
      ext : {
        name : 'komal',
        deviceTypes : deviceTypes(),
        timeOfDay : timeOfDay()
      }
    }
  }

  mergeDeep(reqBidsConfigObj.ortb2Fragments.global, Ortb2);
  callback();
}    

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