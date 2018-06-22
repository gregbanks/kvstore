var _     = require('lodash')
var redis = require('redis')

var carbonio = require('carbon-io')

var __      = carbonio.fibers.__(module)
var carbond = carbonio.carbond
var o       = carbonio.atom.o(module)

__(function() {
  o.main({
    _type: carbond.Service,

    environmentVariables: {
      REDIS_HOST: {
        description: 'The host that redis lives on',
        default: 'localhost',
      },
      REDIS_PORT: {
        description: 'The port that redis listens on',
        default: '6379',
      }
    },

    redisClient: undefined,

    doStart: function() {
      this.redisClient = redis.createClient(
        _.toInteger(
          _.isNil(process.env.REDIS_PORT) ? this.environmentVariables.REDIS_PORT.default :
                                            process.env.REDIS_PORT),
        _.isNil(process.env.REDIS_HOST) ? this.environmentVariables.REDIS_HOST.default :
                                          process.env.REDIS_HOST
      )
    },
    doStop: function() {
      if (!_.isNil(this.redisClient)) {
        this.redisClient.quit()
      }
    },

    // set key/val operation
    post: o({
      _type: carbond.Operation,
      responses: {
        200: {
          schema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      parameters: {
        body: {
          location: 'body',
          description: 'The key/value to set in redis',
          schema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
            required: ['key', 'value'],
            additionalProperties: false,
          },
        },
      },
      handle: function(req, res) {
        var body = req.parameters.body
        this.getService().redisClient.sync.set(body.key, body.value)
        return req.parameters.body
      },
    }),

    endpoints: {
      ':key': o({
        _type: carbond.Endpoint,
        parameters: {
          key: {
            location: 'path',
            schema: {
              type: 'string',
            },
          },
        },

        // get key operation
        get: o({
          _type: carbond.Operation,
          responses: {
            200: {
              schema: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                },
                required: ['key', 'value'],
                additionalProperties: false,
              },
            },
            404: {
              schema: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                  }
                },
                required: ['key'],
                additionalProperties: false,
              },
            },
          },
          handle: function(req, res) {
            var key = req.parameters.key
            var value = _.toString(this.getService().redisClient.sync.get(key))
            if (_.isNil(value)) {
              return null
            }
            return {key: key, value: value}
          }
        }),
      }),
    },
  })
})
