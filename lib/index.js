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
      BIND_PORT: {
        description: 'The port that this service should bind to',
        default: '8888',
      },
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
      this.redisClient = redis.createClient({
        port: _.toInteger(
          _.isNil(process.env.REDIS_PORT) ? this.environmentVariables.REDIS_PORT.default :
                                            process.env.REDIS_PORT),
        host: _.isNil(process.env.REDIS_HOST) ? this.environmentVariables.REDIS_HOST.default :
                                          process.env.REDIS_HOST,
        enable_offline_queue: false,
        retry_strategy: () => {
          return 1000
        }
      })
      this.port = !_.isNil(process.env.BIND_PORT) ? _.toInteger(process.env.BIND_PORT) :
                                                    this.port
    },
    doStop: function() {
      if (!_.isNil(this.redisClient)) {
        this.redisClient.quit()
      }
    },

    endpoints: {
      'store': o({
        _type: carbond.Endpoint,

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
            503: {
              schema: {
                type: 'object',
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
            var self = this
            var ret = undefined
            var body = req.parameters.body
            try {
              ret = function(cb) {
                self.getService().redisClient.set(body.key, body.value, cb)
              }.sync()
            } catch (e) {
              if (!(e instanceof redis.AbortError)) {
                throw e
              }
              throw new (self.getService().errors).ServiceUnavailable('Redis unavailable')
            }
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
                503: {
                  schema: {
                    type: 'object',
                  },
                },
              },
              handle: function(req, res) {
                var self = this
                var value = undefined
                var key = req.parameters.key
                try {
                  value = function(cb) {
                    self.getService().redisClient.get(key, cb)
                  }.sync()
                } catch (e) {
                  if (!(e instanceof redis.AbortError)) {
                    throw e
                  }
                  throw new (self.getService().errors).ServiceUnavailable('Redis unavailable')
                }
                if (_.isNil(value)) {
                  throw new (self.getService().errors).NotFound(key)
                }
                return {key: key, value: _.toString(value)}
              }
            }),
          }),
        },
      }),
      'status': o({
        _type: carbond.Endpoint,
        get: o({
          _type: carbond.Operation,
          responses: {
            200: {
              schema: {
                type: 'object',
              },
            },
            503: {
              schema: {
                type: 'object',
              },
            },
          },
          handle: function(req, res) {
            var self = this
            var status = undefined
            try {
              status = function(cb) {
                self.getService().redisClient.ping('healthy', cb)
              }.sync()
            } catch (e) {
              res.status(503)
              return {'status': 'unhealthy'}
            }
            return {'status': _.toString(status)}
          },
        }),
      }),
    },
  })
})
