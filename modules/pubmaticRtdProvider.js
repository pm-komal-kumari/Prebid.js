import { submodule } from '../src/hook.js';
import { logInfo, logError } from '../src/utils.js';
import { getGlobal } from '../src/prebidGlobal.js';
import {config as conf} from '../src/config.js';

/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

const REAL_TIME_MODULE = 'realTimeData';
const SUBMODULE_NAME = 'pubmatic';

/**
 * Initialize the Adagio RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
function init(config, _userConsent) {  
  console.log('Pubmatic rtd provider -> In init fn -> globalConfig.floors -> ', globalConfig.floors);
}

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */
function getBidRequestData(reqBidsConfigObj, callback, config, userConsent) {
  console.log('Pubmatic rtd provider -> In getBidRequestData fn -> reqBidsConfigObj', reqBidsConfigObj);
  console.log('Pubmatic rtd provider -> In getBidRequestData fn -> config', config);
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
    console.log('Pubmatic rtd provider -> In registerSubModule fn');
    submodule(REAL_TIME_MODULE, pubmaticSubmodule);
  }
  
  registerSubModule();