import {registerBidder} from '../src/adapters/bidderFactory.js';
import {BANNER, NATIVE, VIDEO} from '../src/mediaTypes.js';
import * as utils from '../src/utils.js';
import {ortbConverter} from '../libraries/ortbConverter/converter.js'
import {deepAccess, getBidIdParameter, logError} from '../src/utils.js';

/**
 * @typedef {import('../src/adapters/bidderFactory.js').Bid} Bid
 */

const BIDDER_CODE = 'viant';
const ENDPOINT = 'https://bidders-us.adelphic.net/d/rtb/v25/prebid/bidder'
const ADAPTER_VERSION = '2.0.0';

const DEFAULT_BID_TTL = 300;
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_NET_REVENUE = true;

export const spec = {
  code: BIDDER_CODE,
  aliases: ['viantortb'],
  supportedMediaTypes: [BANNER, VIDEO, NATIVE],

  isBidRequestValid: function (bid) {
    if (bid && typeof bid.params !== 'object') {
      logError(BIDDER_CODE + ': params is not defined or is incorrect in the bidder settings.');
      return false;
    }
    if (!getBidIdParameter('publisherId', bid.params)) {
      logError(BIDDER_CODE + ': publisherId is not present in bidder params.');
      return false;
    }
    const mediaTypesBanner = deepAccess(bid, 'mediaTypes.banner');
    const mediaTypesVideo = deepAccess(bid, 'mediaTypes.video');
    const mediaTypesNative = deepAccess(bid, 'mediaTypes.native');
    if (!mediaTypesBanner && !mediaTypesVideo && !mediaTypesNative) {
      utils.logWarn(BIDDER_CODE + ': one of mediaTypes.banner or mediaTypes.video or mediaTypes.native must be passed');
      return false;
    }
    return true;
  },

  buildRequests,

  interpretResponse(response, request) {
    if (!response.body) {
      response.body = {nbr: 0};
    }
    const bids = converter.fromORTB({request: request.data, response: response.body}).bids;
    return bids;
  },

  /**
   * Register bidder specific code, which will execute if a bid from this bidder won the auction
   * @param {Bid} bid The bid that won the auction
   */
  onBidWon: function (bid) {
    if (bid.burl) {
      utils.triggerPixel(bid.burl);
      utils.triggerPixel(utils.replaceAuctionPrice(bid.burl, bid.originalCpm || bid.cpm));
    } else if (bid.nurl) {
      utils.triggerPixel(bid.nurl);
      utils.triggerPixel(utils.replaceAuctionPrice(bid.nurl, bid.originalCpm || bid.cpm));
    }
  }
}

function buildRequests(bids, bidderRequest) {
  const videoBids = bids.filter(bid => isVideoBid(bid));
  const bannerBids = bids.filter(bid => isBannerBid(bid));
  const nativeBids = bids.filter(bid => isNativeBid(bid));
  const requests = bannerBids.length ? [createRequest(bannerBids, bidderRequest, BANNER)] : [];
  videoBids.forEach(bid => {
    requests.push(createRequest([bid], bidderRequest, VIDEO));
  });
  nativeBids.forEach(bid => {
    requests.push(createRequest([bid], bidderRequest, NATIVE));
  });
  return requests;
}

function createRequest(bidRequests, bidderRequest, mediaType) {
  const data = converter.toORTB({bidRequests, bidderRequest, context: {mediaType}});
  if (bidderRequest.gdprConsent && typeof bidderRequest.gdprConsent.gdprApplies === 'boolean') {
    if (!data.regs) data.regs = {};
    if (!data.regs.ext) data.regs.ext = {};
    data.regs.ext.gdpr = bidderRequest.gdprConsent.gdprApplies ? 1 : 0;
  }
  if (bidderRequest.uspConsent) {
    if (!data.regs) data.regs = {};
    if (!data.regs.ext) data.regs.ext = {};
    data.regs.ext.us_privacy = bidderRequest.uspConsent;
  }
  const imp = data.imp || [];
  const dealsMap = new Map();
  if (bidderRequest.bids) {
    bidderRequest.bids.forEach(bid => {
      if (bid.ortb2Imp && bid.ortb2Imp.pmp) {
        dealsMap.set(bid.bidId, bid.ortb2Imp.pmp);
      }
    });
  }
  imp.forEach((element) => {
    const deals = dealsMap.get(element.id);
    if (deals) {
      element.pmp = deals;
    }
  });
  data.ext = data.ext || {};
  data.ext.viant = {
    adapterVersion: ADAPTER_VERSION
  };
  return {
    method: 'POST',
    url: ENDPOINT,
    data: data
  }
}

function isVideoBid(bid) {
  return deepAccess(bid, 'mediaTypes.video');
}

function isBannerBid(bid) {
  return deepAccess(bid, 'mediaTypes.banner');
}

function isNativeBid(bid) {
  return deepAccess(bid, 'mediaTypes.native');
}

const converter = ortbConverter({
  context: {
    netRevenue: DEFAULT_NET_REVENUE,
    ttl: DEFAULT_BID_TTL,
    currency: DEFAULT_CURRENCY
  }
});

registerBidder(spec);
