/**
 * The {@link module:modules/realTimeData} module is required
 * @module modules/dynamicAdBoost
 * @requires module:modules/realTimeData
 */

import { submodule } from '../src/hook.js'
import { loadExternalScript } from '../src/adloader.js';
import { getGlobal } from '../src/prebidGlobal.js';
import { deepAccess, deepSetValue } from '../src/utils.js';
import { MODULE_TYPE_RTD } from '../src/activities/modules.js';

/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

const MODULE_NAME = 'dynamicAdBoost';
const SCRIPT_URL = 'https://adxbid.info';
const CLIENT_SUPPORTS_IO = window.IntersectionObserver && window.IntersectionObserverEntry && window.IntersectionObserverEntry.prototype &&
    'intersectionRatio' in window.IntersectionObserverEntry.prototype;
// Options for the Intersection Observer
const dabOptions = {
  threshold: 0.5 // Trigger callback when 50% of the element is visible
};
let observer;
let dabStartDate;
let dabStartTime;

// Array of div IDs to track
const dynamicAdBoostAdUnits = {};

function init() {
  dabStartDate = new Date();
  dabStartTime = dabStartDate.getTime();
  if (!CLIENT_SUPPORTS_IO) {
    return false;
  }
  // Create an Intersection Observer instance
  observer = new IntersectionObserver(dabHandleIntersection, dabOptions);
  const keyId = 'rtd-' + window.location.hostname;

  const dabInterval = setInterval(function() {
    const dabDateNow = new Date();
    const dabTimeNow = dabDateNow.getTime();
    const dabElapsedSeconds = Math.floor((dabTimeNow - dabStartTime) / 1000);
    const elapsedThreshold = 0;

    if (dabElapsedSeconds >= elapsedThreshold) {
      clearInterval(dabInterval); // Stop
      loadLmScript(keyId);
    }
  }, 1000);

  return true;
}

function loadLmScript(keyId) {
  const scriptUrl = `${SCRIPT_URL}/${keyId}.js`;
  loadExternalScript(scriptUrl, MODULE_TYPE_RTD, MODULE_NAME);
  observer.disconnect();
}

function getBidRequestData(reqBidsConfigObj, callback) {
  const reqAdUnits = reqBidsConfigObj.adUnits || getGlobal().adUnits;

  if (Array.isArray(reqAdUnits)) {
    reqAdUnits.forEach(adunit => {
      const gptCode = deepAccess(adunit, 'code');
      if (dynamicAdBoostAdUnits.hasOwnProperty(gptCode)) {
        // AdUnits has reached target viewablity at some point
        deepSetValue(adunit, `ortb2Imp.ext.data.${MODULE_NAME}.${gptCode}`, dynamicAdBoostAdUnits[gptCode]);
      }
    });
  }
  callback();
}

const markViewed = (entry, observer) => {
  return () => {
    observer.unobserve(entry.target);
  }
}

// Callback function when an observed element becomes visible
function dabHandleIntersection(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
      dynamicAdBoostAdUnits[entry.target.id] = entry.intersectionRatio;
      markViewed(entry, observer)
    }
  });
}

/** @type {RtdSubmodule} */
export const subModuleObj = {
  name: MODULE_NAME,
  init,
  getBidRequestData,
  markViewed
};

submodule('realTimeData', subModuleObj);
