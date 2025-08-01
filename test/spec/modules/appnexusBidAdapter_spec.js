import { expect } from 'chai';
import { spec } from 'modules/appnexusBidAdapter.js';
import { newBidder } from 'src/adapters/bidderFactory.js';
import { auctionManager } from 'src/auctionManager.js';
import { deepClone } from 'src/utils.js';
import * as utils from 'src/utils.js';
import { config } from 'src/config.js';

const ENDPOINT = 'https://ib.adnxs.com/ut/v3/prebid';

describe('AppNexusAdapter', function () {
  const adapter = newBidder(spec);

  describe('inherited functions', function () {
    it('exists and is a function', function () {
      expect(adapter.callBids).to.exist.and.to.be.a('function');
    });
  });

  function expectKeywords(actual, expected) {
    expect(actual.length).to.equal(expected.length);
    actual.forEach(el => {
      const match = expected.find(ob => ob.key === el.key);
      if (el.value) {
        expect(el.value).to.have.members(match.value);
      } else {
        expect(match.value).to.not.exist;
      }
    })
  }

  describe('isBidRequestValid', function () {
    const bid = {
      'bidder': 'appnexus',
      'params': {
        'placementId': '10433394'
      },
      'adUnitCode': 'adunit-code',
      'sizes': [[300, 250], [300, 600]],
      'bidId': '30b31c1838de1e',
      'bidderRequestId': '22edbae2733bf6',
      'auctionId': '1d1a030790a475',
    };

    it('should return true when required params found', function () {
      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('should return true when required params found', function () {
      const bid1 = deepClone(bid);
      bid1.params = {
        'placement_id': 123423
      }
      expect(spec.isBidRequestValid(bid1)).to.equal(true);
    });

    it('should return true when required params found', function () {
      const bid1 = deepClone(bid);
      bid1.params = {
        'member': '1234',
        'invCode': 'ABCD'
      };

      expect(spec.isBidRequestValid(bid1)).to.equal(true);
    });

    it('should return true when required params found', function () {
      const bid1 = deepClone(bid);
      bid1.params = {
        'member': '1234',
        'inv_code': 'ABCD'
      };

      expect(spec.isBidRequestValid(bid1)).to.equal(true);
    });

    it('should return false when required params are not passed', function () {
      const invalidBid = Object.assign({}, bid);
      delete invalidBid.params;
      invalidBid.params = {
        'placementId': 0
      };
      expect(spec.isBidRequestValid(invalidBid)).to.equal(false);
    });

    it('should return false when required params are not passed', function () {
      const invalidBid = Object.assign({}, bid);
      delete invalidBid.params;
      invalidBid.params = {
        'placement_id': 0
      };
      expect(spec.isBidRequestValid(invalidBid)).to.equal(false);
    });
  });

  describe('buildRequests', function () {
    let getAdUnitsStub;
    const bidRequests = [
      {
        'bidder': 'appnexus',
        'params': {
          'placementId': '10433394'
        },
        'adUnitCode': 'adunit-code',
        'sizes': [[300, 250], [300, 600]],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',
        'transactionId': '04f2659e-c005-4eb1-a57c-fa93145e3843'
      }
    ];

    beforeEach(function () {
      getAdUnitsStub = sinon.stub(auctionManager, 'getAdUnits').callsFake(function () {
        return [];
      });
    });

    afterEach(function () {
      getAdUnitsStub.restore();
    });

    it('should parse out private sizes', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            privateSizes: [300, 250]
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].private_sizes).to.exist;
      expect(payload.tags[0].private_sizes).to.deep.equal([{ width: 300, height: 250 }]);
    });

    it('should parse out private sizes', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            private_sizes: [300, 250]
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].private_sizes).to.exist;
      expect(payload.tags[0].private_sizes).to.deep.equal([{ width: 300, height: 250 }]);
    });

    it('should add position in request', function () {
      // set from bid.params
      let bidRequest = deepClone(bidRequests[0]);
      bidRequest.params.position = 'above';

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].position).to.exist;
      expect(payload.tags[0].position).to.deep.equal(1);

      // set from mediaTypes.banner.pos = 1
      bidRequest = deepClone(bidRequests[0]);
      bidRequest.mediaTypes = {
        banner: { pos: 1 }
      };

      const request2 = spec.buildRequests([bidRequest]);
      const payload2 = JSON.parse(request2.data);

      expect(payload2.tags[0].position).to.exist;
      expect(payload2.tags[0].position).to.deep.equal(1);

      // set from mediaTypes.video.pos = 3
      bidRequest = deepClone(bidRequests[0]);
      bidRequest.mediaTypes = {
        video: { pos: 3 }
      };

      const request3 = spec.buildRequests([bidRequest]);
      const payload3 = JSON.parse(request3.data);

      expect(payload3.tags[0].position).to.exist;
      expect(payload3.tags[0].position).to.deep.equal(2);

      // bid.params trumps mediatypes
      bidRequest = deepClone(bidRequests[0]);
      bidRequest.params.position = 'above';
      bidRequest.mediaTypes = {
        banner: { pos: 3 }
      };

      const request4 = spec.buildRequests([bidRequest]);
      const payload4 = JSON.parse(request4.data);

      expect(payload4.tags[0].position).to.exist;
      expect(payload4.tags[0].position).to.deep.equal(1);
    });

    it('should add publisher_id in request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            publisherId: '1231234'
          }
        });
      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].publisher_id).to.exist;
      expect(payload.tags[0].publisher_id).to.deep.equal(1231234);
      expect(payload.publisher_id).to.exist;
      expect(payload.publisher_id).to.deep.equal(1231234);
    });

    it('should add publisher_id in request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placement_id: '10433394',
            publisher_id: '1231234'
          }
        });
      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].publisher_id).to.exist;
      expect(payload.tags[0].publisher_id).to.deep.equal(1231234);
      expect(payload.publisher_id).to.exist;
      expect(payload.publisher_id).to.deep.equal(1231234);
    });

    it('should add source and verison to the tag', function () {
      const request = spec.buildRequests(bidRequests);
      const payload = JSON.parse(request.data);
      expect(payload.sdk).to.exist;
      expect(payload.sdk).to.deep.equal({
        source: 'pbjs',
        version: '$prebid.version$'
      });
    });

    it('should populate the ad_types array on all requests', function () {
      const adUnits = [{
        code: 'adunit-code',
        mediaTypes: {
          banner: {
            sizes: [[300, 250], [300, 600]]
          }
        },
        bids: [{
          bidder: 'appnexus',
          params: {
            placement_id: '10433394'
          }
        }],
        transactionId: '04f2659e-c005-4eb1-a57c-fa93145e3843'
      }];

      const types = ['banner'];
      if (FEATURES.NATIVE) {
        types.push('native');
      }

      if (FEATURES.VIDEO) {
        types.push('video');
      }

      types.forEach(type => {
        getAdUnitsStub.callsFake(function (...args) {
          return adUnits;
        });

        const bidRequest = Object.assign({}, bidRequests[0]);
        bidRequest.mediaTypes = {};
        bidRequest.mediaTypes[type] = {};

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].ad_types).to.deep.equal([type]);

        if (type === 'banner') {
          delete adUnits[0].mediaTypes;
        }
      });
    });

    it('should not populate the ad_types array when adUnit.mediaTypes is undefined', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].ad_types).to.not.exist;
    });

    if (FEATURES.VIDEO) {
      it('should populate the ad_types array on outstream requests', function () {
        const bidRequest = Object.assign({}, bidRequests[0]);
        bidRequest.mediaTypes = {};
        bidRequest.mediaTypes.video = { context: 'outstream' };

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].ad_types).to.deep.equal(['video']);
        expect(payload.tags[0].hb_source).to.deep.equal(1);
      });

      it('should attach valid video params to the tag', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: {
              placementId: '10433394',
              video: {
                id: 123,
                minduration: 100,
                foobar: 'invalid'
              }
            }
          }
        );

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);
        expect(payload.tags[0].video).to.deep.equal({
          id: 123,
          minduration: 100
        });
        expect(payload.tags[0].hb_source).to.deep.equal(1);
      });

      it('should include ORTB video values when matching video params were not all set', function () {
        const bidRequest = deepClone(bidRequests[0]);
        bidRequest.params = {
          placementId: '1234235',
          video: {
            skippable: true,
            playback_method: ['auto_play_sound_off', 'auto_play_sound_unknown'],
            context: 'outstream'
          }
        };
        bidRequest.mediaTypes = {
          video: {
            playerSize: [640, 480],
            context: 'outstream',
            mimes: ['video/mp4'],
            skip: 0,
            minduration: 5,
            api: [1, 5, 6],
            playbackmethod: [2, 4]
          }
        };

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].video).to.deep.equal({
          minduration: 5,
          playback_method: 2,
          skippable: true,
          context: 4
        });
        expect(payload.tags[0].video_frameworks).to.deep.equal([1, 4])
      });

      it('should include ORTB video values when video params is empty - case 1', function () {
        const bidRequest = deepClone(bidRequests[0]);
        bidRequest.mediaTypes = {
          video: {
            playerSize: [640, 480],
            context: 'outstream',
            placement: 3,
            mimes: ['video/mp4'],
            skip: 0,
            minduration: 5,
            api: [1, 5, 6],
            playbackmethod: [2, 4]
          }
        };

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].video).to.deep.equal({
          minduration: 5,
          playback_method: 2,
          skippable: false,
          context: 4
        });
        expect(payload.tags[0].video_frameworks).to.deep.equal([1, 4])
      });

      it('should include ORTB video values when video params is empty - case 2', function () {
        const bidRequest = deepClone(bidRequests[0]);
        bidRequest.mediaTypes = {
          video: {
            playerSize: [640, 480],
            context: 'outstream',
            plcmt: 2,
            startdelay: 0,
            mimes: ['video/mp4'],
            skip: 1,
            minduration: 5,
            api: [1, 5, 6],
            playbackmethod: [2, 4]
          }
        };

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].video).to.deep.equal({
          minduration: 5,
          playback_method: 2,
          skippable: true,
          context: 8
        });
        expect(payload.tags[0].video_frameworks).to.deep.equal([1, 4])
      });

      it('should include ORTB video values when video params is empty - case 1', function () {
        const bidRequest = deepClone(bidRequests[0]);
        bidRequest.mediaTypes = {
          video: {
            playerSize: [640, 480],
            context: 'outstream',
            mimes: ['video/mp4'],
            startdelay: 0,
            skip: 0,
            minduration: 5,
            api: [1, 5, 6],
            playbackmethod: [2, 4]
          }
        };

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].video).to.deep.equal({
          minduration: 5,
          playback_method: 2,
          skippable: false,
          context: 1
        });
        expect(payload.tags[0].video_frameworks).to.deep.equal([1, 4])
      });

      it('should convert and include ORTB2 device data when available', function () {
        const bidRequest = deepClone(bidRequests[0]);
        const bidderRequest = {
          ortb2: {
            device: {
              w: 980,
              h: 1720,
              dnt: 0,
              ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
              language: 'en',
              devicetype: 1,
              make: 'Apple',
              model: 'iPhone 12 Pro Max',
              os: 'iOS',
              osv: '17.4',
            },
          },
        };

        const expectedDeviceResult = {
          useragent: bidderRequest.ortb2.device.ua,
          devicetype: 'Mobile/Tablet - General',
          make: bidderRequest.ortb2.device.make,
          model: bidderRequest.ortb2.device.model,
          os: bidderRequest.ortb2.device.os,
          os_version: bidderRequest.ortb2.device.osv,
          w: bidderRequest.ortb2.device.w,
          h: bidderRequest.ortb2.device.h,
        };

        const request = spec.buildRequests([bidRequest], bidderRequest);
        const payload = JSON.parse(request.data);

        expect(payload.device).to.deep.equal(expectedDeviceResult);
      });

      it('should add video property when adUnit includes a renderer', function () {
        const videoData = {
          mediaTypes: {
            video: {
              context: 'outstream',
              mimes: ['video/mp4']
            }
          },
          params: {
            placementId: '10433394',
            video: {
              skippable: true,
              playback_method: ['auto_play_sound_off']
            }
          }
        };

        let bidRequest1 = deepClone(bidRequests[0]);
        bidRequest1 = Object.assign({}, bidRequest1, videoData, {
          renderer: {
            url: 'https://test.renderer.url',
            render: function () { }
          }
        });

        let bidRequest2 = deepClone(bidRequests[0]);
        bidRequest2.adUnitCode = 'adUnit_code_2';
        bidRequest2 = Object.assign({}, bidRequest2, videoData);

        const request = spec.buildRequests([bidRequest1, bidRequest2]);
        const payload = JSON.parse(request.data);
        expect(payload.tags[0].video).to.deep.equal({
          skippable: true,
          playback_method: 2,
          custom_renderer_present: true
        });
        expect(payload.tags[1].video).to.deep.equal({
          skippable: true,
          playback_method: 2
        });
      });

      it('should duplicate adpod placements into batches and set correct maxduration', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: { placementId: '14542875' }
          },
          {
            mediaTypes: {
              video: {
                context: 'adpod',
                playerSize: [640, 480],
                adPodDurationSec: 300,
                durationRangeSec: [15, 30],
              }
            }
          }
        );

        const request = spec.buildRequests([bidRequest]);
        const payload1 = JSON.parse(request[0].data);
        const payload2 = JSON.parse(request[1].data);

        // 300 / 15 = 20 total
        expect(payload1.tags.length).to.equal(15);
        expect(payload2.tags.length).to.equal(5);

        expect(payload1.tags[0]).to.deep.equal(payload1.tags[1]);
        expect(payload1.tags[0].video.maxduration).to.equal(30);

        expect(payload2.tags[0]).to.deep.equal(payload1.tags[1]);
        expect(payload2.tags[0].video.maxduration).to.equal(30);
      });

      it('should round down adpod placements when numbers are uneven', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: { placementId: '14542875' }
          },
          {
            mediaTypes: {
              video: {
                context: 'adpod',
                playerSize: [640, 480],
                adPodDurationSec: 123,
                durationRangeSec: [45],
              }
            }
          }
        );

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);
        expect(payload.tags.length).to.equal(2);
      });

      it('should duplicate adpod placements when requireExactDuration is set', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: { placementId: '14542875' }
          },
          {
            mediaTypes: {
              video: {
                context: 'adpod',
                playerSize: [640, 480],
                adPodDurationSec: 300,
                durationRangeSec: [15, 30],
                requireExactDuration: true,
              }
            }
          }
        );

        // 20 total placements with 15 max impressions = 2 requests
        const request = spec.buildRequests([bidRequest]);
        expect(request.length).to.equal(2);

        // 20 spread over 2 requests = 15 in first request, 5 in second
        const payload1 = JSON.parse(request[0].data);
        const payload2 = JSON.parse(request[1].data);
        expect(payload1.tags.length).to.equal(15);
        expect(payload2.tags.length).to.equal(5);

        // 10 placements should have max/min at 15
        // 10 placemenst should have max/min at 30
        const payload1tagsWith15 = payload1.tags.filter(tag => tag.video.maxduration === 15);
        const payload1tagsWith30 = payload1.tags.filter(tag => tag.video.maxduration === 30);
        expect(payload1tagsWith15.length).to.equal(10);
        expect(payload1tagsWith30.length).to.equal(5);

        // 5 placemenst with min/max at 30 were in the first request
        // so 5 remaining should be in the second
        const payload2tagsWith30 = payload2.tags.filter(tag => tag.video.maxduration === 30);
        expect(payload2tagsWith30.length).to.equal(5);
      });

      it('should set durations for placements when requireExactDuration is set and numbers are uneven', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: { placementId: '14542875' }
          },
          {
            mediaTypes: {
              video: {
                context: 'adpod',
                playerSize: [640, 480],
                adPodDurationSec: 105,
                durationRangeSec: [15, 30, 60],
                requireExactDuration: true,
              }
            }
          }
        );

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);
        expect(payload.tags.length).to.equal(7);

        const tagsWith15 = payload.tags.filter(tag => tag.video.maxduration === 15);
        const tagsWith30 = payload.tags.filter(tag => tag.video.maxduration === 30);
        const tagsWith60 = payload.tags.filter(tag => tag.video.maxduration === 60);
        expect(tagsWith15.length).to.equal(3);
        expect(tagsWith30.length).to.equal(3);
        expect(tagsWith60.length).to.equal(1);
      });

      it('should break adpod request into batches', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: { placementId: '14542875' }
          },
          {
            mediaTypes: {
              video: {
                context: 'adpod',
                playerSize: [640, 480],
                adPodDurationSec: 225,
                durationRangeSec: [5],
              }
            }
          }
        );

        const request = spec.buildRequests([bidRequest]);
        const payload1 = JSON.parse(request[0].data);
        const payload2 = JSON.parse(request[1].data);
        const payload3 = JSON.parse(request[2].data);

        expect(payload1.tags.length).to.equal(15);
        expect(payload2.tags.length).to.equal(15);
        expect(payload3.tags.length).to.equal(15);
      });

      it('should contain hb_source value for adpod', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            params: { placementId: '14542875' }
          },
          {
            mediaTypes: {
              video: {
                context: 'adpod',
                playerSize: [640, 480],
                adPodDurationSec: 300,
                durationRangeSec: [15, 30],
              }
            }
          }
        );
        const request = spec.buildRequests([bidRequest])[0];
        const payload = JSON.parse(request.data);
        expect(payload.tags[0].hb_source).to.deep.equal(7);
      });
    } // VIDEO

    it('sends bid request to ENDPOINT via POST', function () {
      const request = spec.buildRequests(bidRequests);
      expect(request.url).to.equal(ENDPOINT);
      expect(request.method).to.equal('POST');
    });

    it('should attach valid user params to the tag', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placement_id: '10433394',
            user: {
              externalUid: '123',
              segments: [123, { id: 987, value: 876 }],
              foobar: 'invalid'
            }
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.user).to.exist;
      expect(payload.user).to.deep.equal({
        external_uid: '123',
        segments: [{ id: 123 }, { id: 987, value: 876 }]
      });
    });

    it('should add debug params from query', function () {
      const getParamStub = sinon.stub(utils, 'getParameterByName').callsFake(function(par) {
        if (par === 'apn_debug_dongle') return 'abcdef';
        if (par === 'apn_debug_member_id') return '1234';
        if (par === 'apn_debug_timeout') return '1000';

        return '';
      });

      const bidRequest = deepClone(bidRequests[0]);
      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.debug).to.exist.and.to.deep.equal({
        'dongle': 'abcdef',
        'enabled': true,
        'member_id': 1234,
        'debug_timeout': 1000
      });

      getParamStub.restore();
    });

    it('should attach reserve param when either bid param or getFloor function exists', function () {
      const getFloorResponse = { currency: 'USD', floor: 3 };
      let request; let payload = null;
      const bidRequest = deepClone(bidRequests[0]);

      // 1 -> reserve not defined, getFloor not defined > empty
      request = spec.buildRequests([bidRequest]);
      payload = JSON.parse(request.data);

      expect(payload.tags[0].reserve).to.not.exist;

      // 2 -> reserve is defined, getFloor not defined > reserve is used
      bidRequest.params = {
        'placement_id': '10433394',
        'reserve': 0.5
      };
      request = spec.buildRequests([bidRequest]);
      payload = JSON.parse(request.data);

      expect(payload.tags[0].reserve).to.exist.and.to.equal(0.5);

      // 3 -> reserve is defined, getFloor is defined > getFloor is used
      bidRequest.getFloor = () => getFloorResponse;

      request = spec.buildRequests([bidRequest]);
      payload = JSON.parse(request.data);

      expect(payload.tags[0].reserve).to.exist.and.to.equal(3);
    });

    it('should contain hb_source value for other media', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          mediaType: 'banner',
          params: {
            sizes: [[300, 250], [300, 600]],
            placement_id: 13144370
          }
        }
      );
      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);
      expect(payload.tags[0].hb_source).to.deep.equal(1);
    });

    it('adds brand_category_exclusion to request when set', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      sinon
        .stub(config, 'getConfig')
        .withArgs('adpod.brandCategoryExclusion')
        .returns(true);

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.brand_category_uniqueness).to.equal(true);

      config.getConfig.restore();
    });

    it('adds auction level keywords and ortb2 keywords to request when set', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      sinon
        .stub(config, 'getConfig')
        .withArgs('appnexusAuctionKeywords')
        .returns({
          gender: 'm',
          music: ['rock', 'pop'],
          test: '',
          tools: 'power'
        });

      const bidderRequest = {
        ortb2: {
          site: {
            keywords: 'power tools, drills, tools=industrial',
            content: {
              keywords: 'video, source=streaming'
            }
          },
          user: {
            keywords: 'tools=home,renting'
          },
          app: {
            keywords: 'app=iphone 11',
            content: {
              keywords: 'appcontent=home repair, dyi'
            }
          }
        }
      };

      const request = spec.buildRequests([bidRequest], bidderRequest);
      const payload = JSON.parse(request.data);

      expectKeywords(payload.keywords, [{
        'key': 'gender',
        'value': ['m']
      }, {
        'key': 'music',
        'value': ['rock', 'pop']
      }, {
        'key': 'test'
      }, {
        'key': 'tools',
        'value': ['power', 'industrial', 'home']
      }, {
        'key': 'power tools'
      }, {
        'key': 'drills'
      }, {
        'key': 'video'
      }, {
        'key': 'source',
        'value': ['streaming']
      }, {
        'key': 'renting'
      }, {
        'key': 'app',
        'value': ['iphone 11']
      }, {
        'key': 'appcontent',
        'value': ['home repair']
      }, {
        'key': 'dyi'
      }]);

      config.getConfig.restore();
    });

    it('adds ortb2 segments to auction request as keywords', function() {
      const bidRequest = Object.assign({}, bidRequests[0]);
      const bidderRequest = {
        ortb2: {
          site: {
            keywords: 'drill',
            content: {
              data: [{
                name: 'siteseg1',
                ext: {
                  segtax: 540
                },
                segment: [{
                  id: 's123',
                }, {
                  id: 's234'
                }]
              }, {
                name: 'sitseg2',
                ext: {
                  segtax: 1
                },
                segment: [{
                  id: 'unknown'
                }]
              }, {
                name: 'siteseg3',
                ext: {
                  segtax: 526
                },
                segment: [{
                  id: 'dog'
                }]
              }]
            }
          },
          user: {
            data: [{
              name: 'userseg1',
              ext: {
                segtax: 526
              },
              segment: [{
                id: 'cat'
              }]
            }]
          }
        }
      };
      const request = spec.buildRequests([bidRequest], bidderRequest);
      const payload = JSON.parse(request.data);

      expectKeywords(payload.keywords, [{
        'key': 'drill'
      }, {
        'key': '1plusX',
        'value': ['cat', 'dog']
      }, {
        'key': 'perid',
        'value': ['s123', 's234']
      }]);
    });

    if (FEATURES.NATIVE) {
      it('should attach native params to the request', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            mediaType: 'native',
            nativeParams: {
              title: { required: true },
              body: { required: true },
              body2: { required: true },
              image: { required: true, sizes: [100, 100] },
              icon: { required: true },
              cta: { required: false },
              rating: { required: true },
              sponsoredBy: { required: true },
              privacyLink: { required: true },
              displayUrl: { required: true },
              address: { required: true },
              downloads: { required: true },
              likes: { required: true },
              phone: { required: true },
              price: { required: true },
              salePrice: { required: true }
            }
          }
        );

        const request = spec.buildRequests([bidRequest]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].native.layouts[0]).to.deep.equal({
          title: { required: true },
          description: { required: true },
          desc2: { required: true },
          main_image: { required: true, sizes: [{ width: 100, height: 100 }] },
          icon: { required: true },
          ctatext: { required: false },
          rating: { required: true },
          sponsored_by: { required: true },
          privacy_link: { required: true },
          displayurl: { required: true },
          address: { required: true },
          downloads: { required: true },
          likes: { required: true },
          phone: { required: true },
          price: { required: true },
          saleprice: { required: true },
          privacy_supported: true
        });
        expect(payload.tags[0].hb_source).to.equal(1);
      });

      it('should always populated tags[].sizes with 1,1 for native if otherwise not defined', function () {
        const bidRequest = Object.assign({},
          bidRequests[0],
          {
            mediaType: 'native',
            nativeParams: {
              image: { required: true }
            }
          }
        );
        bidRequest.sizes = [[150, 100], [300, 250]];

        let request = spec.buildRequests([bidRequest]);
        let payload = JSON.parse(request.data);
        expect(payload.tags[0].sizes).to.deep.equal([{ width: 150, height: 100 }, { width: 300, height: 250 }]);

        delete bidRequest.sizes;

        request = spec.buildRequests([bidRequest]);
        payload = JSON.parse(request.data);

        expect(payload.tags[0].sizes).to.deep.equal([{ width: 1, height: 1 }]);
      });
    }

    it('should convert keyword params (when there are no ortb keywords) to proper form and attaches to request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placement_id: '10433394',
            keywords: {
              single: 'val',
              singleArr: ['val'],
              singleArrNum: [5],
              multiValMixed: ['value1', 2, 'value3'],
              singleValNum: 123,
              emptyStr: '',
              emptyArr: [''],
              badValue: { 'foo': 'bar' } // should be dropped
            }
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expectKeywords(payload.tags[0].keywords, [
        {
          'key': 'single',
          'value': ['val']
        }, {
          'key': 'singleArr',
          'value': ['val']
        }, {
          'key': 'singleArrNum',
          'value': ['5']
        }, {
          'key': 'multiValMixed',
          'value': ['value1', '2', 'value3']
        }, {
          'key': 'singleValNum',
          'value': ['123']
        }, {
          'key': 'emptyStr'
        }, {
          'key': 'emptyArr'
        }
      ])
    });

    it('should convert adUnit ortb2 keywords (when there are no bid param keywords) to proper form and attaches to request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          ortb2Imp: {
            ext: {
              data: {
                keywords: 'ortb2=yes,ortb2test, multiValMixed=4, singleValNum=456'
              }
            }
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expectKeywords(payload.tags[0].keywords, [{
        'key': 'ortb2',
        'value': ['yes']
      }, {
        'key': 'ortb2test'
      }, {
        'key': 'multiValMixed',
        'value': ['4']
      }, {
        'key': 'singleValNum',
        'value': ['456']
      }]);
    });

    it('should convert keyword params and adUnit ortb2 keywords to proper form and attaches to request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            keywords: {
              single: 'val',
              singleArr: ['val'],
              singleArrNum: [5],
              multiValMixed: ['value1', 2, 'value3'],
              singleValNum: 123,
              emptyStr: '',
              emptyArr: [''],
              badValue: { 'foo': 'bar' } // should be dropped
            }
          },
          ortb2Imp: {
            ext: {
              data: {
                keywords: 'ortb2=yes,ortb2test, multiValMixed=4, singleValNum=456'
              }
            }
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expectKeywords(payload.tags[0].keywords, [{
        'key': 'single',
        'value': ['val']
      }, {
        'key': 'singleArr',
        'value': ['val']
      }, {
        'key': 'singleArrNum',
        'value': ['5']
      }, {
        'key': 'multiValMixed',
        'value': ['value1', '2', 'value3', '4']
      }, {
        'key': 'singleValNum',
        'value': ['123', '456']
      }, {
        'key': 'emptyStr'
      }, {
        'key': 'emptyArr'
      }, {
        'key': 'ortb2',
        'value': ['yes']
      }, {
        'key': 'ortb2test'
      }]);
    });

    it('should add payment rules to the request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            usePaymentRule: true
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].use_pmt_rule).to.equal(true);
    });

    it('should add payment rules to the request', function () {
      const bidRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placement_id: '10433394',
            use_payment_rule: true
          }
        }
      );

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].use_pmt_rule).to.equal(true);
    });

    it('should add preferred gpid to the request', function () {
      const testGpid = '/12345/my-gpt-tag-0';
      const bidRequest = deepClone(bidRequests[0]);
      bidRequest.ortb2Imp = { ext: { gpid: testGpid } };

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].gpid).to.exist.and.equal(testGpid);
    });

    it('should add backup gpid to the request', function () {
      const testGpid = '/12345/my-gpt-tag-0';
      const bidRequest = deepClone(bidRequests[0]);
      bidRequest.ortb2Imp = { ext: { data: {}, gpid: testGpid } };

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].gpid).to.exist.and.equal(testGpid);
    });

    it('should add tid to the request', function () {
      const testTid = '1234test';
      const bidRequest = deepClone(bidRequests[0]);
      bidRequest.ortb2Imp = { ext: { tid: testTid } };
      // bidRequest.ortb2 = { source: { tid: testTid } };

      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        ortb2: {
          source: {
            tid: testTid
          }
        }
      };
      bidderRequest.bids = [bidRequest];

      const request = spec.buildRequests([bidRequest], bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.tags[0].tid).to.exist.and.equal(testTid);
      expect(payload.source.tid).to.exist.and.equal(testTid);
    });

    it('should add gdpr consent information to the request', function () {
      const consentString = 'BOJ8RZsOJ8RZsABAB8AAAAAZ+A==';
      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        'gdprConsent': {
          consentString: consentString,
          gdprApplies: true,
          addtlConsent: '1~7.12.35.62.66.70.89.93.108'
        }
      };
      bidderRequest.bids = bidRequests;

      const request = spec.buildRequests(bidRequests, bidderRequest);
      expect(request.options).to.deep.equal({ withCredentials: true });
      const payload = JSON.parse(request.data);

      expect(payload.gdpr_consent).to.exist;
      expect(payload.gdpr_consent.consent_string).to.exist.and.to.equal(consentString);
      expect(payload.gdpr_consent.consent_required).to.exist.and.to.be.true;
      expect(payload.gdpr_consent.addtl_consent).to.exist.and.to.deep.equal([7, 12, 35, 62, 66, 70, 89, 93, 108]);
    });

    it('should add us privacy string to payload', function () {
      const consentString = '1YA-';
      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        'uspConsent': consentString
      };
      bidderRequest.bids = bidRequests;

      const request = spec.buildRequests(bidRequests, bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.us_privacy).to.exist;
      expect(payload.us_privacy).to.exist.and.to.equal(consentString);
    });

    it('should add gpp information to the request via bidderRequest.gppConsent', function () {
      const consentString = 'abc1234';
      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        'gppConsent': {
          'gppString': consentString,
          'applicableSections': [8]
        }
      };
      bidderRequest.bids = bidRequests;

      const request = spec.buildRequests(bidRequests, bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.privacy).to.exist;
      expect(payload.privacy.gpp).to.equal(consentString);
      expect(payload.privacy.gpp_sid).to.deep.equal([8]);
    });

    it('should add gpp information to the request via bidderRequest.ortb2.regs', function () {
      const consentString = 'abc1234';
      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        'ortb2': {
          'regs': {
            'gpp': consentString,
            'gpp_sid': [7]
          }
        }
      };
      bidderRequest.bids = bidRequests;

      const request = spec.buildRequests(bidRequests, bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.privacy).to.exist;
      expect(payload.privacy.gpp).to.equal(consentString);
      expect(payload.privacy.gpp_sid).to.deep.equal([7]);
    });

    it('should add dsa information to the request via bidderRequest.ortb2.regs.ext.dsa', function () {
      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        'ortb2': {
          'regs': {
            'ext': {
              'dsa': {
                'dsarequired': 1,
                'pubrender': 0,
                'datatopub': 1,
                'transparency': [{
                  'domain': 'good-domain',
                  'dsaparams': [1, 2]
                }, {
                  'domain': 'bad-setup',
                  'dsaparams': ['1', 3]
                }]
              }
            }
          }
        }
      };
      bidderRequest.bids = bidRequests;

      const request = spec.buildRequests(bidRequests, bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.dsa).to.exist;
      expect(payload.dsa.dsarequired).to.equal(1);
      expect(payload.dsa.pubrender).to.equal(0);
      expect(payload.dsa.datatopub).to.equal(1);
      expect(payload.dsa.transparency).to.deep.equal([{
        'domain': 'good-domain',
        'dsaparams': [1, 2]
      }]);
    });

    it('supports sending hybrid mobile app parameters', function () {
      const appRequest = Object.assign({},
        bidRequests[0],
        {
          params: {
            placementId: '10433394',
            app: {
              id: 'B1O2W3M4AN.com.prebid.webview',
              geo: {
                lat: 40.0964439,
                lng: -75.3009142
              },
              device_id: {
                idfa: '4D12078D-3246-4DA4-AD5E-7610481E7AE', // Apple advertising identifier
                aaid: '38400000-8cf0-11bd-b23e-10b96e40000d', // Android advertising identifier
                md5udid: '5756ae9022b2ea1e47d84fead75220c8', // MD5 hash of the ANDROID_ID
                sha1udid: '4DFAA92388699AC6539885AEF1719293879985BF', // SHA1 hash of the ANDROID_ID
                windowsadid: '750c6be243f1c4b5c9912b95a5742fc5' // Windows advertising identifier
              }
            }
          }
        }
      );
      const request = spec.buildRequests([appRequest]);
      const payload = JSON.parse(request.data);
      expect(payload.app).to.exist;
      expect(payload.app).to.deep.equal({
        appid: 'B1O2W3M4AN.com.prebid.webview'
      });
      expect(payload.device.device_id).to.exist;
      expect(payload.device.device_id).to.deep.equal({
        aaid: '38400000-8cf0-11bd-b23e-10b96e40000d',
        idfa: '4D12078D-3246-4DA4-AD5E-7610481E7AE',
        md5udid: '5756ae9022b2ea1e47d84fead75220c8',
        sha1udid: '4DFAA92388699AC6539885AEF1719293879985BF',
        windowsadid: '750c6be243f1c4b5c9912b95a5742fc5'
      });
      expect(payload.device.geo).to.exist;
      expect(payload.device.geo).to.deep.equal({
        lat: 40.0964439,
        lng: -75.3009142
      });
    });

    it('should add referer info to payload', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      const bidderRequest = {
        refererInfo: {
          topmostLocation: 'https://example.com/page.html',
          reachedTop: true,
          numIframes: 2,
          stack: [
            'https://example.com/page.html',
            'https://example.com/iframe1.html',
            'https://example.com/iframe2.html'
          ]
        }
      }
      const request = spec.buildRequests([bidRequest], bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.referrer_detection).to.exist;
      expect(payload.referrer_detection).to.deep.equal({
        rd_ref: 'https%3A%2F%2Fexample.com%2Fpage.html',
        rd_top: true,
        rd_ifs: 2,
        rd_stk: bidderRequest.refererInfo.stack.map((url) => encodeURIComponent(url)).join(',')
      });
    });

    it('if defined, should include publisher pageUrl to normal referer info in payload', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);

      const bidderRequest = {
        refererInfo: {
          canonicalUrl: 'https://mypub.override.com/test/page.html',
          topmostLocation: 'https://example.com/page.html',
          reachedTop: true,
          numIframes: 2,
          stack: [
            'https://example.com/page.html',
            'https://example.com/iframe1.html',
            'https://example.com/iframe2.html'
          ]
        }
      }
      const request = spec.buildRequests([bidRequest], bidderRequest);
      const payload = JSON.parse(request.data);

      expect(payload.referrer_detection).to.exist;
      expect(payload.referrer_detection).to.deep.equal({
        rd_ref: 'https%3A%2F%2Fexample.com%2Fpage.html',
        rd_top: true,
        rd_ifs: 2,
        rd_stk: bidderRequest.refererInfo.stack.map((url) => encodeURIComponent(url)).join(','),
        rd_can: 'https://mypub.override.com/test/page.html'
      });
    });

    it('should populate schain if available', function () {
      const bidRequest = Object.assign({}, bidRequests[0], {
        ortb2: {
          source: {
            ext: {
              schain: {
                ver: '1.0',
                complete: 1,
                nodes: [
                  {
                    'asi': 'blob.com',
                    'sid': '001',
                    'hp': 1
                  }
                ]
              }
            }
          }
        }
      });

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);
      expect(payload.schain).to.deep.equal({
        ver: '1.0',
        complete: 1,
        nodes: [
          {
            'asi': 'blob.com',
            'sid': '001',
            'hp': 1
          }
        ]
      });
    });

    it('should populate coppa if set in config', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      sinon.stub(config, 'getConfig')
        .withArgs('coppa')
        .returns(true);

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);

      expect(payload.user.coppa).to.equal(true);

      config.getConfig.restore();
    });

    describe('ast_override_div', function () {
      let getParamStub;
      const bidRequest = Object.assign({}, bidRequests[0]);
      const bidRequest2 = deepClone(bidRequests[0]);
      bidRequest2.adUnitCode = 'adUnit_code_2';
      const bidRequest3 = deepClone(bidRequests[0]);
      bidRequest3.adUnitCode = 'adUnit_code_3';

      before(function () {
        getParamStub = sinon.stub(utils, 'getParameterByName');
      });

      it('should set forced creative id if one adUnitCode passed', function () {
        getParamStub.callsFake(function(par) {
          if (par === 'ast_override_div') return 'adunit-code:1234';
          return '';
        });

        const request = spec.buildRequests([bidRequest, bidRequest2]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].force_creative_id).to.deep.equal(1234);
        expect(payload.tags[1].force_creative_id).to.not.exist;
      });

      it('should set forced creative id if `ast_override_div` is set to override multiple adUnitCode', function () {
        getParamStub.callsFake(function(par) {
          if (par === 'ast_override_div') return 'adunit-code:1234,adUnit_code_2:5678';
          return '';
        });

        const request = spec.buildRequests([bidRequest, bidRequest2, bidRequest3]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].force_creative_id).to.deep.equal(1234);
        expect(payload.tags[1].force_creative_id).to.deep.equal(5678);
        expect(payload.tags[2].force_creative_id).to.not.exist;
      });

      it('should not set forced creative id if `ast_override_div` is missing creativeId', function () {
        getParamStub.callsFake(function(par) {
          if (par === 'ast_override_div') return 'adunit-code';
          return '';
        });

        const request = spec.buildRequests([bidRequest, bidRequest2]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].force_creative_id).to.not.exist;
        expect(payload.tags[1].force_creative_id).to.not.exist;
      });

      it('should not set forced creative id if `ast_override_div` is in the wrong format', function () {
        getParamStub.callsFake(function(par) {
          if (par === 'ast_override_div') return 'adunit-code;adUnit_code_2:5678';
          return '';
        }); ;

        const request = spec.buildRequests([bidRequest, bidRequest2]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].force_creative_id).to.not.exist;
        expect(payload.tags[1].force_creative_id).to.not.exist;
      });

      it('should not set forced creative id if `ast_override_div` is missing', function () {
        getParamStub.callsFake(function(par) {
          return '';
        }); ;

        const request = spec.buildRequests([bidRequest, bidRequest2]);
        const payload = JSON.parse(request.data);

        expect(payload.tags[0].force_creative_id).to.not.exist;
        expect(payload.tags[1].force_creative_id).to.not.exist;
      });

      after(function () {
        getParamStub.restore();
      });
    });

    it('should set the X-Is-Test customHeader if test flag is enabled', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      sinon.stub(config, 'getConfig')
        .withArgs('apn_test')
        .returns(true);

      const request = spec.buildRequests([bidRequest]);
      expect(request.options.customHeaders).to.deep.equal({ 'X-Is-Test': 1 });

      config.getConfig.restore();
    });

    it('should always set withCredentials: true on the request.options', function () {
      const bidRequest = Object.assign({}, bidRequests[0]);
      const request = spec.buildRequests([bidRequest]);
      expect(request.options.withCredentials).to.equal(true);
    });

    it('should set simple domain variant if purpose 1 consent is not given', function () {
      const consentString = 'BOJ8RZsOJ8RZsABAB8AAAAAZ+A==';
      const bidderRequest = {
        'bidderCode': 'appnexus',
        'auctionId': '1d1a030790a475',
        'bidderRequestId': '22edbae2733bf6',
        'timeout': 3000,
        'gdprConsent': {
          consentString: consentString,
          gdprApplies: true,
          apiVersion: 2,
          vendorData: {
            purpose: {
              consents: {
                1: false
              }
            }
          }
        }
      };
      bidderRequest.bids = bidRequests;

      const request = spec.buildRequests(bidRequests, bidderRequest);
      expect(request.url).to.equal('https://ib.adnxs-simple.com/ut/v3/prebid');
    });

    it('should populate eids when supported userIds are available', function () {
      const bidRequest = Object.assign({}, bidRequests[0], {
        userIdAsEids: [{
          source: 'adserver.org',
          uids: [{ id: 'sample-userid' }]
        }, {
          source: 'criteo.com',
          uids: [{ id: 'sample-criteo-userid' }]
        }, {
          source: 'netid.de',
          uids: [{ id: 'sample-netId-userid' }]
        }, {
          source: 'liveramp.com',
          uids: [{ id: 'sample-idl-userid' }]
        }, {
          source: 'uidapi.com',
          uids: [{ id: 'sample-uid2-value' }]
        }, {
          source: 'puburl.com',
          uids: [{ id: 'pubid1' }]
        }, {
          source: 'puburl2.com',
          uids: [{ id: 'pubid2' }, { id: 'pubid2-123' }]
        }]
      });

      const request = spec.buildRequests([bidRequest]);
      const payload = JSON.parse(request.data);
      expect(payload.eids).to.deep.include({
        source: 'adserver.org',
        id: 'sample-userid',
        rti_partner: 'TDID'
      });

      expect(payload.eids).to.deep.include({
        source: 'criteo.com',
        id: 'sample-criteo-userid',
      });

      expect(payload.eids).to.deep.include({
        source: 'netid.de',
        id: 'sample-netId-userid',
      });

      expect(payload.eids).to.deep.include({
        source: 'liveramp.com',
        id: 'sample-idl-userid'
      });

      expect(payload.eids).to.deep.include({
        source: 'uidapi.com',
        id: 'sample-uid2-value',
        rti_partner: 'UID2'
      });

      expect(payload.eids).to.deep.include({
        source: 'puburl.com',
        id: 'pubid1'
      });

      expect(payload.eids).to.deep.include({
        source: 'puburl2.com',
        id: 'pubid2'
      });
      expect(payload.eids).to.deep.include({
        source: 'puburl2.com',
        id: 'pubid2-123'
      });
    });

    it('should populate iab_support object at the root level if omid support is detected', function () {
      let request, payload;

      if (FEATURES.VIDEO) {
        // with bid.params.frameworks
        const bidRequest_A = Object.assign({}, bidRequests[0], {
          params: {
            frameworks: [1, 2, 5, 6],
            video: {
              frameworks: [1, 2, 5, 6]
            }
          }
        });
        request = spec.buildRequests([bidRequest_A]);
        payload = JSON.parse(request.data);
        expect(payload.iab_support).to.be.an('object');
        expect(payload.iab_support).to.deep.equal({
          omidpn: 'Appnexus',
          omidpv: '$prebid.version$'
        });
        expect(payload.tags[0].banner_frameworks).to.be.an('array');
        expect(payload.tags[0].banner_frameworks).to.deep.equal([1, 2, 5, 6]);
        expect(payload.tags[0].video_frameworks).to.be.an('array');
        expect(payload.tags[0].video_frameworks).to.deep.equal([1, 2, 5, 6]);
        expect(payload.tags[0].video.frameworks).to.not.exist;
      }

      // without bid.params.frameworks
      const bidRequest_B = Object.assign({}, bidRequests[0]);
      request = spec.buildRequests([bidRequest_B]);
      payload = JSON.parse(request.data);
      expect(payload.iab_support).to.not.exist;
      expect(payload.tags[0].banner_frameworks).to.not.exist;
      expect(payload.tags[0].video_frameworks).to.not.exist;

      if (FEATURES.VIDEO) {
        // with video.frameworks but it is not an array
        const bidRequest_C = Object.assign({}, bidRequests[0], {
          params: {
            video: {
              frameworks: "'1', '2', '3', '6'"
            }
          }
        });
        request = spec.buildRequests([bidRequest_C]);
        payload = JSON.parse(request.data);
        expect(payload.iab_support).to.not.exist;
        expect(payload.tags[0].banner_frameworks).to.not.exist;
        expect(payload.tags[0].video_frameworks).to.not.exist;
      }
    });
  })

  describe('interpretResponse', function () {
    let bidderSettingsStorage;

    before(function () {
      bidderSettingsStorage = $$PREBID_GLOBAL$$.bidderSettings;
    });

    after(function () {
      $$PREBID_GLOBAL$$.bidderSettings = bidderSettingsStorage;
    });

    const response = {
      'version': '3.0.0',
      'tags': [
        {
          'uuid': '3db3773286ee59',
          'tag_id': 10433394,
          'auction_id': '4534722592064951574',
          'nobid': false,
          'no_ad_url': 'https://lax1-ib.adnxs.com/no-ad',
          'timeout_ms': 10000,
          'ad_profile_id': 27079,
          'ads': [
            {
              'content_source': 'rtb',
              'ad_type': 'banner',
              'buyer_member_id': 958,
              'creative_id': 29681110,
              'media_type_id': 1,
              'media_subtype_id': 1,
              'cpm': 0.5,
              'cpm_publisher_currency': 0.5,
              'publisher_currency_code': '$',
              'client_initiated_ad_counting': true,
              'viewability': {
                'config': '<script type=\'text/javascript\' async=\'true\' src=\'https://adsdk.bing.net/viewability/banner.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=%native_dom_id%;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=https%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttps253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>'
              },
              'dsa': {
                'behalf': 'test-behalf',
                'paid': 'test-paid',
                'transparency': [{
                  'domain': 'good-domain',
                  'params': [1, 2, 3]
                }],
                'adrender': 1
              },
              'rtb': {
                'banner': {
                  'content': '<!-- Creative -->',
                  'width': 300,
                  'height': 250
                },
                'trackers': [
                  {
                    'impression_urls': [
                      'https://lax1-ib.adnxs.com/impression',
                      'https://www.test.com/tracker'
                    ],
                    'video_events': {}
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    it('should get correct bid response', function () {
      const expectedResponse = [
        {
          'adId': '3a1f23123e',
          'requestId': '3db3773286ee59',
          'cpm': 0.5,
          'creativeId': 29681110,
          'dealId': undefined,
          'width': 300,
          'height': 250,
          'ad': '<!-- Creative -->',
          'mediaType': 'banner',
          'currency': 'USD',
          'ttl': 300,
          'netRevenue': true,
          'adUnitCode': 'code',
          'appnexus': {
            'buyerMemberId': 958
          },
          'meta': {
            'dchain': {
              'ver': '1.0',
              'complete': 0,
              'nodes': [{
                'bsid': '958'
              }]
            },
            'dsa': {
              'behalf': 'test-behalf',
              'paid': 'test-paid',
              'transparency': [{
                'domain': 'good-domain',
                'params': [1, 2, 3]
              }],
              'adrender': 1
            }
          }
        }
      ];
      const bidderRequest = {
        bids: [{
          bidId: '3db3773286ee59',
          adUnitCode: 'code'
        }]
      };
      const result = spec.interpretResponse({ body: response }, { bidderRequest });
      expect(Object.keys(result[0])).to.have.members(Object.keys(expectedResponse[0]));
    });

    it('should reject 0 cpm bids', function () {
      const zeroCpmResponse = deepClone(response);
      zeroCpmResponse.tags[0].ads[0].cpm = 0;

      const bidderRequest = {
        bidderCode: 'appnexus'
      };

      const result = spec.interpretResponse({ body: zeroCpmResponse }, { bidderRequest });
      expect(result.length).to.equal(0);
    });

    it('should allow 0 cpm bids if allowZeroCpmBids setConfig is true', function () {
      $$PREBID_GLOBAL$$.bidderSettings = {
        appnexus: {
          allowZeroCpmBids: true
        }
      };

      const zeroCpmResponse = deepClone(response);
      zeroCpmResponse.tags[0].ads[0].cpm = 0;

      const bidderRequest = {
        bidderCode: 'appnexus',
        bids: [{
          bidId: '3db3773286ee59',
          adUnitCode: 'code'
        }]
      };

      const result = spec.interpretResponse({ body: zeroCpmResponse }, { bidderRequest });
      expect(result.length).to.equal(1);
      expect(result[0].cpm).to.equal(0);
    });

    it('handles nobid responses', function () {
      const response = {
        'version': '0.0.1',
        'tags': [{
          'uuid': '84ab500420319d',
          'tag_id': 5976557,
          'auction_id': '297492697822162468',
          'nobid': true
        }]
      };
      let bidderRequest;

      const result = spec.interpretResponse({ body: response }, { bidderRequest });
      expect(result.length).to.equal(0);
    });

    if (FEATURES.VIDEO) {
      it('handles outstream video responses', function () {
        const response = {
          'tags': [{
            'uuid': '84ab500420319d',
            'ads': [{
              'ad_type': 'video',
              'cpm': 0.500000,
              'notify_url': 'imptracker.com',
              'rtb': {
                'video': {
                  'content': '<!-- VAST Creative -->'
                }
              },
              'javascriptTrackers': '<script type=\'text/javascript\' async=\'true\' src=\'https://adsdk.bing.net/viewability/banner.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=%native_dom_id%;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=https%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttps253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>'
            }]
          }]
        };
        const bidderRequest = {
          bids: [{
            bidId: '84ab500420319d',
            adUnitCode: 'code',
            mediaTypes: {
              video: {
                context: 'outstream'
              }
            }
          }]
        }

        const result = spec.interpretResponse({ body: response }, { bidderRequest });
        expect(result[0]).to.have.property('vastXml');
        expect(result[0]).to.have.property('vastImpUrl');
        expect(result[0]).to.have.property('mediaType', 'video');
      });

      it('handles instream video responses', function () {
        const response = {
          'tags': [{
            'uuid': '84ab500420319d',
            'ads': [{
              'ad_type': 'video',
              'cpm': 0.500000,
              'notify_url': 'imptracker.com',
              'rtb': {
                'video': {
                  'asset_url': 'https://sample.vastURL.com/here/vid'
                }
              },
              'javascriptTrackers': '<script type=\'text/javascript\' async=\'true\' src=\'https://adsdk.bing.net/viewability/banner.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=%native_dom_id%;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=https%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttps253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>'
            }]
          }]
        };
        const bidderRequest = {
          bids: [{
            bidId: '84ab500420319d',
            adUnitCode: 'code',
            mediaTypes: {
              video: {
                context: 'instream'
              }
            }
          }]
        }

        const result = spec.interpretResponse({ body: response }, { bidderRequest });
        expect(result[0]).to.have.property('vastUrl');
        expect(result[0]).to.have.property('vastImpUrl');
        expect(result[0]).to.have.property('mediaType', 'video');
      });

      it('handles adpod responses', function () {
        const response = {
          'tags': [{
            'uuid': '84ab500420319d',
            'ads': [{
              'ad_type': 'video',
              'brand_category_id': 10,
              'cpm': 0.500000,
              'notify_url': 'imptracker.com',
              'rtb': {
                'video': {
                  'asset_url': 'https://sample.vastURL.com/here/adpod',
                  'duration_ms': 30000,
                }
              },
              'viewability': {
                'config': '<script type=\'text/javascript\' async=\'true\' src=\'https://adsdk.bing.net/viewability/banner.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=%native_dom_id%;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=https%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttps253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>'
              }
            }]
          }]
        };

        const bidderRequest = {
          bids: [{
            bidId: '84ab500420319d',
            adUnitCode: 'code',
            mediaTypes: {
              video: {
                context: 'adpod'
              }
            }
          }]
        };

        const result = spec.interpretResponse({ body: response }, { bidderRequest });
        expect(result[0]).to.have.property('vastUrl');
        expect(result[0].video.context).to.equal('adpod');
        expect(result[0].video.durationSeconds).to.equal(30);
      });
    }

    if (FEATURES.NATIVE) {
      const BASE_NATIVE = {
        'title': 'Native Creative',
        'desc': 'Cool description great stuff',
        'desc2': 'Additional body text',
        'ctatext': 'Do it',
        'sponsored': 'AppNexus',
        'icon': {
          'width': 0,
          'height': 0,
          'url': 'https://cdn.adnxs.com/icon.png'
        },
        'main_img': {
          'width': 2352,
          'height': 1516,
          'url': 'https://cdn.adnxs.com/img.png'
        },
        'link': {
          'url': 'https://www.appnexus.com',
          'fallback_url': '',
          'click_trackers': ['https://nym1-ib.adnxs.com/click']
        },
        'impression_trackers': ['https://example.com'],
        'rating': '5',
        'displayurl': 'https://AppNexus.com/?url=display_url',
        'likes': '38908320',
        'downloads': '874983',
        'price': '9.99',
        'saleprice': 'FREE',
        'phone': '1234567890',
        'address': '28 W 23rd St, New York, NY 10010',
        'privacy_link': 'https://appnexus.com/?url=privacy_url',
        'javascriptTrackers': '<script type=\'text/javascript\' async=\'true\' src=\'https://adsdk.bing.net/viewability/banner.js#v;vk=appnexus.com-omid;tv=native1-18h;dom_id=;css_selector=.pb-click;st=0;d=1x1;vc=iab;vid_ccr=1;tag_id=13232354;cb=https%3A%2F%2Fams1-ib.adnxs.com%2Fvevent%3Freferrer%3Dhttps253A%252F%252Ftestpages-pmahe.tp.adnxs.net%252F01_basic_single%26e%3DwqT_3QLNB6DNAwAAAwDWAAUBCLfl_-MFEMStk8u3lPTjRxih88aF0fq_2QsqNgkAAAECCCRAEQEHEAAAJEAZEQkAIREJACkRCQAxEQmoMOLRpwY47UhA7UhIAlCDy74uWJzxW2AAaM26dXjzjwWAAQGKAQNVU0SSAQEG8FCYAQGgAQGoAQGwAQC4AQHAAQTIAQLQAQDYAQDgAQDwAQCKAjt1ZignYScsIDI1Mjk4ODUsIDE1NTE4ODkwNzkpO3VmKCdyJywgOTc0OTQ0MDM2HgDwjZIC8QEha0RXaXBnajgtTHdLRUlQTHZpNFlBQ0NjOFZzd0FEZ0FRQVJJN1VoUTR0R25CbGdBWU1rR2FBQndMSGlrTDRBQlVvZ0JwQy1RQVFHWUFRR2dBUUdvQVFPd0FRQzVBZk90YXFRQUFDUkF3UUh6cldxa0FBQWtRTWtCbWo4dDA1ZU84VF9aQVFBQUEBAyRQQV80QUVBOVFFAQ4sQW1BSUFvQUlBdFFJBRAAdg0IeHdBSUF5QUlBNEFJQTZBSUEtQUlBZ0FNQm1BTUJxQVAFzIh1Z01KUVUxVE1UbzBNekl3NEFPVENBLi6aAmEhUXcxdGNRagUoEfQkblBGYklBUW9BRAl8AEEBqAREbzJEABRRSk1JU1EBGwRBQQGsAFURDAxBQUFXHQzwWNgCAOACrZhI6gIzaHR0cDovL3Rlc3RwYWdlcy1wbWFoZS50cC5hZG54cy5uZXQvMDFfYmFzaWNfc2luZ2xl8gITCg9DVVNUT01fTU9ERUxfSUQSAPICGgoWMhYAPExFQUZfTkFNRRIA8gIeCho2HQAIQVNUAT7wnElGSUVEEgCAAwCIAwGQAwCYAxegAwGqAwDAA-CoAcgDANgD8ao-4AMA6AMA-AMBgAQAkgQNL3V0L3YzL3ByZWJpZJgEAKIECjEwLjIuMTIuMzioBIqpB7IEDggAEAEYACAAKAAwADgCuAQAwAQAyAQA0gQOOTMyNSNBTVMxOjQzMjDaBAIIAeAEAfAEg8u-LogFAZgFAKAF______8BAxgBwAUAyQUABQEU8D_SBQkJBQt8AAAA2AUB4AUB8AWZ9CH6BQQIABAAkAYBmAYAuAYAwQYBITAAAPA_yAYA2gYWChAAOgEAGBAAGADgBgw.%26s%3D971dce9d49b6bee447c8a58774fb30b40fe98171;ts=1551889079;cet=0;cecb=\'></script>',
        'video': {
          'content': '<?xml version=\"1.0\"></xml>'
        }
      };

      it('handles native responses', function () {
        const response1 = deepClone(response);
        response1.tags[0].ads[0].ad_type = 'native';
        response1.tags[0].ads[0].rtb.native = BASE_NATIVE;
        const bidderRequest = {
          bids: [{
            bidId: '3db3773286ee59',
            adUnitCode: 'code'
          }]
        }

        const result = spec.interpretResponse({ body: response1 }, { bidderRequest });
        expect(result[0].native.title).to.equal('Native Creative');
        expect(result[0].native.body).to.equal('Cool description great stuff');
        expect(result[0].native.body2).to.equal('Additional body text');
        expect(result[0].native.cta).to.equal('Do it');
        expect(result[0].native.image.url).to.equal('https://cdn.adnxs.com/img.png');
        // Video is technically not a base Prebid native field, so it should be included as part of the ext
        // But it's also included here for backwards compatibility if people read the bid directly
        expect(result[0].native.video.content).to.equal('<?xml version=\"1.0\"></xml>');
      });

      it('handles custom native fields as ext', function () {
        const response1 = deepClone(response);
        response1.tags[0].ads[0].ad_type = 'native';
        response1.tags[0].ads[0].rtb.native = {
          ...BASE_NATIVE,
          // 'video' is included in base native
          'title1': 'Custom Title 1',
          'title2': 'Custom Title 2',
          'title3': 'Custom Title 3',
          'title4': 'Custom Title 4',
          'title5': 'Custom Title 5',
          // Not to be confused with Prebid's base native body & body2
          'body1': 'Custom Body 1',
          'body2': 'Custom Body 2',
          'body3': 'Custom Body 3',
          'body4': 'Custom Body 4',
          'body5': 'Custom Body 5',
          'image1': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_1.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'image2': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_2.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'image3': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_3.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'image4': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_4.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'image5': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_5.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'icon1': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'icon2': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'icon3': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'icon4': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'icon5': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'socialicon1': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'socialicon2': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'socialicon3': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'socialicon4': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'socialicon5': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'socialurl1': 'https://www.xandr.com/platform/monetize/#socialUrl1',
          'socialurl2': 'https://www.xandr.com/platform/monetize/#socialUrl2',
          'socialurl3': 'https://www.xandr.com/platform/monetize/#socialUrl3',
          'socialurl4': 'https://www.xandr.com/platform/monetize/#socialUrl4',
          'socialurl5': 'https://www.xandr.com/platform/monetize/#socialUrl5',
          'displayurl1': 'https://www.xandr.com/platform/monetize/#displayUrl1',
          'displayurl2': 'https://www.xandr.com/platform/monetize/#displayUrl2',
          'displayurl3': 'https://www.xandr.com/platform/monetize/#displayUrl3',
          'displayurl4': 'https://www.xandr.com/platform/monetize/#displayUrl4',
          'displayurl5': 'https://www.xandr.com/platform/monetize/#displayUrl5',
          'ctatext1': 'Custom CTA 1',
          'ctatext2': 'Custom CTA 2',
          'ctatext3': 'Custom CTA 3',
          'ctatext4': 'Custom CTA 4',
          'ctatext5': 'Custom CTA 5',
        };
        const bidderRequest = {
          bids: [{
            bidId: '3db3773286ee59',
            adUnitCode: 'code'
          }]
        }

        const result = spec.interpretResponse({ body: response1 }, { bidderRequest });
        expect(result[0].native.ext).to.deep.equal({
          'video': {
            'content': '<?xml version=\"1.0\"></xml>'
          },
          'customTitle1': 'Custom Title 1',
          'customTitle2': 'Custom Title 2',
          'customTitle3': 'Custom Title 3',
          'customTitle4': 'Custom Title 4',
          'customTitle5': 'Custom Title 5',
          'customBody1': 'Custom Body 1',
          'customBody2': 'Custom Body 2',
          'customBody3': 'Custom Body 3',
          'customBody4': 'Custom Body 4',
          'customBody5': 'Custom Body 5',
          'customImage1': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_1.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'customImage2': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_2.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'customImage3': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_3.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'customImage4': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_4.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'customImage5': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/custom_image_5.jpg?[fullhash]',
            'height': 627,
            'width': 1200,
          },
          'customIcon1': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customIcon2': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customIcon3': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customIcon4': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customIcon5': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customSocialIcon1': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customSocialIcon2': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customSocialIcon3': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customSocialIcon4': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customSocialIcon5': {
            'url': 'https://monetize.xandr.com/creative-ui/assets/logo.jpg?[fullhash]',
            'height': 128,
            'width': 128,
          },
          'customSocialUrl1': 'https://www.xandr.com/platform/monetize/#socialUrl1',
          'customSocialUrl2': 'https://www.xandr.com/platform/monetize/#socialUrl2',
          'customSocialUrl3': 'https://www.xandr.com/platform/monetize/#socialUrl3',
          'customSocialUrl4': 'https://www.xandr.com/platform/monetize/#socialUrl4',
          'customSocialUrl5': 'https://www.xandr.com/platform/monetize/#socialUrl5',
          'customDisplayUrl1': 'https://www.xandr.com/platform/monetize/#displayUrl1',
          'customDisplayUrl2': 'https://www.xandr.com/platform/monetize/#displayUrl2',
          'customDisplayUrl3': 'https://www.xandr.com/platform/monetize/#displayUrl3',
          'customDisplayUrl4': 'https://www.xandr.com/platform/monetize/#displayUrl4',
          'customDisplayUrl5': 'https://www.xandr.com/platform/monetize/#displayUrl5',
          'customCta1': 'Custom CTA 1',
          'customCta2': 'Custom CTA 2',
          'customCta3': 'Custom CTA 3',
          'customCta4': 'Custom CTA 4',
          'customCta5': 'Custom CTA 5',
        });
      });
    }

    if (FEATURES.VIDEO) {
      it('supports configuring outstream renderers', function () {
        const outstreamResponse = deepClone(response);
        outstreamResponse.tags[0].ads[0].rtb.video = {};
        outstreamResponse.tags[0].ads[0].renderer_url = 'renderer.js';

        const bidderRequest = {
          bids: [{
            bidId: '3db3773286ee59',
            renderer: {
              options: {
                adText: 'configured'
              }
            },
            mediaTypes: {
              video: {
                context: 'outstream'
              }
            }
          }]
        };

        const result = spec.interpretResponse({ body: outstreamResponse }, { bidderRequest });
        expect(result[0].renderer.config).to.deep.equal(
          bidderRequest.bids[0].renderer.options
        );
      });

      it('should add deal_priority and deal_code', function () {
        const responseWithDeal = deepClone(response);
        responseWithDeal.tags[0].ads[0].ad_type = 'video';
        responseWithDeal.tags[0].ads[0].deal_priority = 5;
        responseWithDeal.tags[0].ads[0].deal_code = '123';
        responseWithDeal.tags[0].ads[0].rtb.video = {
          duration_ms: 1500,
          player_width: 640,
          player_height: 340,
        };

        const bidderRequest = {
          bids: [{
            bidId: '3db3773286ee59',
            adUnitCode: 'code',
            mediaTypes: {
              video: {
                context: 'adpod'
              }
            }
          }]
        }
        const result = spec.interpretResponse({ body: responseWithDeal }, { bidderRequest });
        expect(Object.keys(result[0].appnexus)).to.include.members(['buyerMemberId', 'dealPriority', 'dealCode']);
        expect(result[0].video.dealTier).to.equal(5);
      });
    }

    it('should add advertiser id', function () {
      const responseAdvertiserId = deepClone(response);
      responseAdvertiserId.tags[0].ads[0].advertiser_id = '123';

      const bidderRequest = {
        bids: [{
          bidId: '3db3773286ee59',
          adUnitCode: 'code'
        }]
      }
      const result = spec.interpretResponse({ body: responseAdvertiserId }, { bidderRequest });
      expect(Object.keys(result[0].meta)).to.include.members(['advertiserId']);
    });

    it('should add brand id', function () {
      const responseBrandId = deepClone(response);
      responseBrandId.tags[0].ads[0].brand_id = 123;

      const bidderRequest = {
        bids: [{
          bidId: '3db3773286ee59',
          adUnitCode: 'code'
        }]
      }
      const result = spec.interpretResponse({ body: responseBrandId }, { bidderRequest });
      expect(Object.keys(result[0].meta)).to.include.members(['brandId']);
    });

    it('should add advertiserDomains', function () {
      const responseAdvertiserId = deepClone(response);
      responseAdvertiserId.tags[0].ads[0].adomain = '123';

      const bidderRequest = {
        bids: [{
          bidId: '3db3773286ee59',
          adUnitCode: 'code'
        }]
      }
      const result = spec.interpretResponse({ body: responseAdvertiserId }, { bidderRequest });
      expect(Object.keys(result[0].meta)).to.include.members(['advertiserDomains']);
      expect(result[0].meta.advertiserDomains).to.deep.equal(['123']);
    });
  });

  describe('getUserSyncs', function() {
    let syncOptions, gdprConsent;

    beforeEach(() => {
      gdprConsent = {
        gdprApplies: true,
        consentString: 'CPJl4C8PJl4C8OoAAAENAwCMAP_AAH_AAAAAAPgAAAAIAPgAAAAIAAA.IGLtV_T9fb2vj-_Z99_tkeYwf95y3p-wzhheMs-8NyZeH_B4Wv2MyvBX4JiQKGRgksjLBAQdtHGlcTQgBwIlViTLMYk2MjzNKJrJEilsbO2dYGD9Pn8HT3ZCY70-vv__7v3ff_3g',
        vendorData: {
          purpose: {
            consents: {
              '1': true
            }
          }
        }
      }
    });

    describe('pixel', function () {
      beforeEach(() => {
        syncOptions = { pixelEnabled: true };
      });

      it('pixelEnabled on', function () {
        const result = spec.getUserSyncs(syncOptions, [], gdprConsent, null);
        expect(result).to.have.length(1);
        expect(result[0].type).to.equal('image');
        expect(result[0].url).to.equal('https://px.ads.linkedin.com/setuid?partner=appNexus');
      });

      it('pixelEnabled off', function () {
        syncOptions.pixelEnabled = false;
        const result = spec.getUserSyncs(syncOptions, [], gdprConsent, null);
        expect(result).to.be.undefined;
      });
    });

    describe('iframe', function () {
      beforeEach(() => {
        syncOptions = { iframeEnabled: true };
      });

      it('iframeEnabled on with gdpr purpose 1 on', function () {
        const result = spec.getUserSyncs(syncOptions, [], gdprConsent, null);
        expect(result).to.have.length(1);
        expect(result[0].type).to.equal('iframe');
        expect(result[0].url).to.equal('https://acdn.adnxs.com/dmp/async_usersync.html');
      });

      it('iframeEnabled on with gdpr purpose1 off', function () {
        gdprConsent.vendorData.purpose.consents['1'] = false

        const result = spec.getUserSyncs(syncOptions, [], gdprConsent, null);
        expect(result).to.be.undefined;
      });

      it('iframeEnabled on without gdpr', function () {
        const result = spec.getUserSyncs(syncOptions, [], null, null);
        expect(result).to.have.length(1);
        expect(result[0].type).to.equal('iframe');
        expect(result[0].url).to.equal('https://acdn.adnxs.com/dmp/async_usersync.html');
      });

      it('iframeEnabled off', function () {
        syncOptions.iframeEnabled = false;
        const result = spec.getUserSyncs(syncOptions, [], gdprConsent, null);
        expect(result).to.be.undefined;
      });
    });
  });
});
