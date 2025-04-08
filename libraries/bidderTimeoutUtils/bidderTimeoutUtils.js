import { logInfo } from '../../src/utils.js';

/**
 * Returns an array of a given object's own enumerable string-keyed property [key, value] pairs.
 * @param {Object} obj
 * @return {Array}
 */
const entries = Object.entries || function (obj) {
    const ownProps = Object.keys(obj);
    let i = ownProps.length;
    let resArray = new Array(i);
    while (i--) { resArray[i] = [ownProps[i], obj[ownProps[i]]]; }
    return resArray;
};

export function getDeviceType() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if ((/ipad|android 3.0|xoom|sch-i800|playbook|tablet|kindle/i.test(userAgent))) {
        return 5; // tablet
    }
    if ((/iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent))) {
        return 4; // mobile
    }
    return 2; // personal computer
}

export function checkVideo(adUnits) {
    return adUnits.some((adUnit) => {
        return adUnit.mediaTypes && adUnit.mediaTypes.video;
    });
}

export function getConnectionSpeed() {
    const connection = window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection || {}
    const connectionType = connection.type || connection.effectiveType;

    switch (connectionType) {
        case 'slow-2g':
        case '2g':
            return 'slow';

        case '3g':
            return 'medium';

        case 'bluetooth':
        case 'cellular':
        case 'ethernet':
        case 'wifi':
        case 'wimax':
        case '4g':
            return 'fast';
    }

    return 'unknown';
}



/**
 * Calculate the time to be added to the timeout
 * @param {Array} adUnits
 * @param {Object} rules
 * @return {number}
 */
export function calculateTimeoutModifier(adUnits, rules) {
    if (!rules) {
        return 0;
    }

    logInfo('Timeout rules', rules);
    let timeoutModifier = 0;
    let toAdd = 0;

    if (rules.includesVideo) {
        const hasVideo = checkVideo(adUnits);
        toAdd = rules.includesVideo[hasVideo] || 0;
        logInfo(`Adding ${toAdd} to timeout for includesVideo ${hasVideo}`)
        timeoutModifier += toAdd;
    }

    if (rules.numAdUnits) {
        const numAdUnits = adUnits.length;
        if (rules.numAdUnits[numAdUnits]) {
            timeoutModifier += rules.numAdUnits[numAdUnits];
        } else {
            for (const [rangeStr, timeoutVal] of entries(rules.numAdUnits)) {
                const [lowerBound, upperBound] = rangeStr.split('-');
                if (parseInt(lowerBound) <= numAdUnits && numAdUnits <= parseInt(upperBound)) {
                    logInfo(`Adding ${timeoutVal} to timeout for numAdUnits ${numAdUnits}`)
                    timeoutModifier += timeoutVal;
                    break;
                }
            }
        }
    }

    if (rules.deviceType) {
        const deviceType = getDeviceType();
        toAdd = rules.deviceType[deviceType] || 0;
        logInfo(`Adding ${toAdd} to timeout for deviceType ${deviceType}`)
        timeoutModifier += toAdd;
    }

    if (rules.connectionSpeed) {
        const connectionSpeed = getConnectionSpeed();
        toAdd = rules.connectionSpeed[connectionSpeed] || 0;
        logInfo(`Adding ${toAdd} to timeout for connectionSpeed ${connectionSpeed}`)
        timeoutModifier += toAdd;
    }

    logInfo('timeout Modifier calculated', timeoutModifier);
    return timeoutModifier;
}
