import {expect} from 'chai';
import {spec} from 'modules/mediasquareBidAdapter.js';
import { server } from 'test/mocks/xhr.js';

describe('MediaSquare bid adapter tests', function () {
  var DEFAULT_PARAMS = [{
    adUnitCode: 'banner-div',
    bidId: 'aaaa1234',
    auctionId: 'bbbb1234',
    ortb2Imp: {
      ext: {
        tid: 'cccc1234',
      }
    },
    mediaTypes: {
      banner: {
        sizes: [
          [300, 250]
        ]
      }
    },
    bidder: 'mediasquare',
    params: {
      owner: 'test',
      code: 'publishername_atf_desktop_rg_pave'
    },
  }];
  var VIDEO_PARAMS = [{
    adUnitCode: 'banner-div',
    bidId: 'aaaa1234',
    auctionId: 'bbbb1234',
    transactionId: 'cccc1234',
    mediaTypes: {
      video: {
        context: 'instream',
        playerSize: [640, 480],
        mimes: ['video/mp4'],
      }
    },
    bidder: 'mediasquare',
    params: {
      owner: 'test',
      code: 'publishername_atf_desktop_rg_pave'
    },
  }];
  var NATIVE_PARAMS = [{
    adUnitCode: 'banner-div',
    bidId: 'aaaa1234',
    auctionId: 'bbbb1234',
    transactionId: 'cccc1234',
    mediaTypes: {
      native: {
        title: {
          required: true,
          len: 80
        },
      }
    },
    bidder: 'mediasquare',
    params: {
      owner: 'test',
      code: 'publishername_atf_desktop_rg_pave'
    },
  }];
  var FLOORS_PARAMS = [{
    adUnitCode: 'banner-div',
    bidId: 'aaaa1234',
    auctionId: 'bbbb1234',
    transactionId: 'cccc1234',
    mediaTypes: {
      banner: {
        sizes: [
          [300, 250]
        ]
      }
    },
    bidder: 'mediasquare',
    params: {
      owner: 'test',
      code: 'publishername_atf_desktop_rg_pave'
    },
    sizes: [[300, 250]],
    getFloor: function (a) { return { currency: 'USD', floor: 1.0 }; },
  }];
  var BID_RESPONSE = {'body': {
    'responses': [{
      'transaction_id': 'cccc1234',
      'cpm': 22.256608,
      'width': 300,
      'height': 250,
      'creative_id': '158534630',
      'currency': 'USD',
      'originalCpm': 25.0123,
      'originalCurrency': 'USD',
      'net_revenue': true,
      'ttl': 300,
      'ad': '< --- creative code --- >',
      'bidder': 'msqClassic',
      'code': 'test/publishername_atf_desktop_rg_pave',
      'bid_id': 'aaaa1234',
      'adomain': ['test.com'],
      'context': 'instream',
      'increment': 1.0,
      'ova': 'cleared',
      'dsa': {
        'behalf': 'some-behalf',
        'paid': 'some-paid',
        'transparency': [{
          'domain': 'test.com',
          'dsaparams': [1, 2, 3]
        }],
        'adrender': 1
      }
    }],
  }};

  const DEFAULT_OPTIONS = {
    ortb2: {
      regs: {
        ext: {
          dsa: {
            dsarequired: '1',
            pubrender: '2',
            datatopub: '3',
            transparency: [{
              domain: 'test.com',
              dsaparams: [1, 2, 3]
            }]
          }
        }
      }
    },
    userIdAsEids: [{
      "source": "superid.com",
      "uids": [{
        "id": "12345678",
        "atype": 1
      }]
    }],
    gdprConsent: {
      gdprApplies: true,
      consentString: 'BOzZdA0OzZdA0AGABBENDJ-AAAAvh7_______9______9uz_Ov_v_f__33e8__9v_l_7_-___u_-33d4-_1vf99yfm1-7ftr3tp_87ues2_Xur__79__3z3_9pxP78k89r7337Mw_v-_v-b7JCPN_Y3v-8Kg',
      vendorData: {}
    },
    refererInfo: {
      referer: 'https://www.prebid.org',
      canonicalUrl: 'https://www.prebid.org/the/link/to/the/page'
    },
    uspConsent: '111222333',
    userId: { 'id5id': { uid: '1111' } },
    schain: {
      'ver': '1.0',
      'complete': 1,
      'nodes': [{
        'asi': 'exchange1.com',
        'sid': '1234',
        'hp': 1,
        'rid': 'bid-request-1',
        'name': 'publisher',
        'domain': 'publisher.com'
      }]
    },
  };
  it('Verify build request', function () {
    const request = spec.buildRequests(DEFAULT_PARAMS, DEFAULT_OPTIONS);
    expect(request).to.have.property('url').and.to.equal('https://pbs-front.mediasquare.fr/msq_prebid');
    expect(request).to.have.property('method').and.to.equal('POST');
    const requestContent = JSON.parse(request.data);
    expect(requestContent.codes[0]).to.have.property('owner').and.to.equal('test');
    expect(requestContent.codes[0]).to.have.property('code').and.to.equal('publishername_atf_desktop_rg_pave');
    expect(requestContent.codes[0]).to.have.property('adunit').and.to.equal('banner-div');
    expect(requestContent.codes[0]).to.have.property('bidId').and.to.equal('aaaa1234');
    expect(requestContent.codes[0]).not.to.have.property('auctionId');
    expect(requestContent.codes[0]).not.to.have.property('transactionId');
    expect(requestContent.codes[0]).to.have.property('mediatypes').exist;
    expect(requestContent.codes[0]).to.have.property('floor').exist;
    expect(requestContent.codes[0]).to.have.property('ortb2Imp').exist;
    expect(requestContent).to.have.property('ortb2').exist;
    expect(requestContent.eids).exist;
    expect(requestContent.eids).to.have.lengthOf(1);
    expect(requestContent.codes[0].floor).to.deep.equal({});
    expect(requestContent).to.have.property('dsa');
    const requestfloor = spec.buildRequests(FLOORS_PARAMS, DEFAULT_OPTIONS);
    const responsefloor = JSON.parse(requestfloor.data);
    expect(responsefloor.codes[0]).to.have.property('floor').exist;
    expect(responsefloor.codes[0].floor).to.have.property('300x250').and.to.have.property('floor').and.to.equal(1);
    expect(responsefloor.codes[0].floor).to.have.property('*');
  });

  it('Verify parse response', function () {
    const request = spec.buildRequests(DEFAULT_PARAMS, DEFAULT_OPTIONS);
    const response = spec.interpretResponse(BID_RESPONSE, request);
    expect(response).to.have.lengthOf(1);
    const bid = response[0];
    expect(bid.cpm).to.equal(22.256608);
    expect(bid.ad).to.equal('< --- creative code --- >');
    expect(bid.width).to.equal(300);
    expect(bid.height).to.equal(250);
    expect(bid.creativeId).to.equal('158534630');
    expect(bid.currency).to.equal('USD');
    expect(bid.netRevenue).to.equal(true);
    expect(bid.ttl).to.equal(300);
    expect(bid.requestId).to.equal('aaaa1234');
    expect(bid.mediasquare).to.exist;
    expect(bid.mediasquare.bidder).to.exist;
    expect(bid.mediasquare.bidder).to.equal('msqClassic');
    expect(bid.mediasquare.context).to.exist;
    expect(bid.mediasquare.context).to.equal('instream');
    expect(bid.mediasquare.increment).to.exist;
    expect(bid.mediasquare.increment).to.equal(1.0);
    expect(bid.mediasquare.code).to.equal([DEFAULT_PARAMS[0].params.owner, DEFAULT_PARAMS[0].params.code].join('/'));
    expect(bid.mediasquare.ova).to.exist.and.to.equal('cleared');
    expect(bid.meta).to.exist;
    expect(bid.meta.advertiserDomains).to.exist;
    expect(bid.meta.advertiserDomains).to.have.lengthOf(1);
    expect(bid.meta.dsa).to.exist;
  });
  it('Verifies match', function () {
    const request = spec.buildRequests(DEFAULT_PARAMS, DEFAULT_OPTIONS);
    BID_RESPONSE.body.responses[0].match = true;
    const response = spec.interpretResponse(BID_RESPONSE, request);
    const bid = response[0];
    expect(bid.mediasquare.match).to.exist;
    expect(bid.mediasquare.match).to.equal(true);
  });
  it('Verifies hasConsent', function () {
    const request = spec.buildRequests(DEFAULT_PARAMS, DEFAULT_OPTIONS);
    BID_RESPONSE.body.responses[0].hasConsent = true;
    const response = spec.interpretResponse(BID_RESPONSE, request);
    const bid = response[0];
    expect(bid.mediasquare.hasConsent).to.exist;
    expect(bid.mediasquare.hasConsent).to.equal(true);
  });
  it('Verifies bidder code', function () {
    expect(spec.code).to.equal('mediasquare');
  });

  it('Verifies bidder aliases', function () {
    expect(spec.aliases).to.have.lengthOf(1);
    expect(spec.aliases[0]).to.equal('msq');
  });
  it('Verifies if bid request valid', function () {
    expect(spec.isBidRequestValid(DEFAULT_PARAMS[0])).to.equal(true);
  });
  it('Verifies bid won', function () {
    const request = spec.buildRequests(DEFAULT_PARAMS, DEFAULT_OPTIONS);
    BID_RESPONSE.body.responses[0].match = true
    BID_RESPONSE.body.responses[0].hasConsent = true;
    const response = spec.interpretResponse(BID_RESPONSE, request);
    const won = spec.onBidWon(response[0]);
    expect(won).to.equal(true);
    expect(server.requests.length).to.equal(1);
    const message = JSON.parse(server.requests[0].requestBody);
    expect(message).to.have.property('increment').exist;
    expect(message).to.have.property('increment').and.to.equal('1');
    expect(message).to.have.property('ova').and.to.equal('cleared');
  });
  it('Verifies user sync without cookie in bid response', function () {
    var syncs = spec.getUserSyncs({}, [BID_RESPONSE], DEFAULT_OPTIONS.gdprConsent, DEFAULT_OPTIONS.uspConsent);
    expect(syncs).to.have.lengthOf(0);
  });
  it('Verifies user sync with cookies in bid response', function () {
    BID_RESPONSE.body.cookies = [{'type': 'image', 'url': 'http://www.cookie.sync.org/'}];
    var syncs = spec.getUserSyncs({}, [BID_RESPONSE], DEFAULT_OPTIONS.gdprConsent);
    expect(syncs).to.have.lengthOf(1);
    expect(syncs[0]).to.have.property('type').and.to.equal('image');
    expect(syncs[0]).to.have.property('url').and.to.equal('http://www.cookie.sync.org/');
  });
  it('Verifies user sync with no bid response', function() {
    var syncs = spec.getUserSyncs({}, null, DEFAULT_OPTIONS.gdprConsent, DEFAULT_OPTIONS.uspConsent);
    expect(syncs).to.have.lengthOf(0);
  });
  it('Verifies user sync with no bid body response', function() {
    let syncs = spec.getUserSyncs({}, [], DEFAULT_OPTIONS.gdprConsent, DEFAULT_OPTIONS.uspConsent);
    expect(syncs).to.have.lengthOf(0);
    syncs = spec.getUserSyncs({}, [{}], DEFAULT_OPTIONS.gdprConsent, DEFAULT_OPTIONS.uspConsent);
    expect(syncs).to.have.lengthOf(0);
  });
  it('Verifies native in bid response', function () {
    const request = spec.buildRequests(NATIVE_PARAMS, DEFAULT_OPTIONS);
    BID_RESPONSE.body.responses[0].native = {'title': 'native title'};
    const response = spec.interpretResponse(BID_RESPONSE, request);
    expect(response).to.have.lengthOf(1);
    const bid = response[0];
    expect(bid).to.have.property('native');
    delete BID_RESPONSE.body.responses[0].native;
  });
  it('Verifies video in bid response', function () {
    const request = spec.buildRequests(VIDEO_PARAMS, DEFAULT_OPTIONS);
    BID_RESPONSE.body.responses[0].video = {'xml': 'my vast XML', 'url': 'my vast url'};
    const response = spec.interpretResponse(BID_RESPONSE, request);
    expect(response).to.have.lengthOf(1);
    const bid = response[0];
    expect(bid).to.have.property('vastXml');
    expect(bid).to.have.property('vastUrl');
    expect(bid).to.have.property('renderer');
    delete BID_RESPONSE.body.responses[0].video;
  });
});
