/**
 * Letsecript module for Redbird (c) Optimalbits 2016
 *
 *
 *
 */
var letsencrypt = require('letsencrypt');

/**
 *  LetsEncrypt certificates are stored like the following:
 *
 *  /example.com
 *    /
 *
 *
 *
 */
var leStoreConfig = {};
var webrootPath = ':configDir/:hostname/.well-known/acme-challenge';

function init(certPath, port, logger) {
  var http = require('http');
  var path = require('path');
  var url = require('url');
  var fs = require('fs');

  logger && logger.info('Initializing letsscript, path %s, port: %s', certPath, port);

  leStoreConfig = {
    configDir: certPath,
    privkeyPath: ':configDir/:hostname/privkey.pem',
    fullchainPath: ':configDir/:hostname/fullchain.pem',
    certPath: ':configDir/:hostname/cert.pem',
    chainPath: ':configDir/:hostname/chain.pem',

    workDir: ':configDir/letsencrypt/var/lib',
    logsDir: ':configDir/letsencrypt/var/log',

    webrootPath: webrootPath,
    debug: false
  }

  // we need to proxy for example: 'example.com/.well-known/acme-challenge' -> 'localhost:port/example.com/'
  http.createServer(function (req, res) {
    var uri = url.parse(req.url).pathname;
    var filename = path.join(certPath, uri);

    logger && logger.info('LetsEncrypt CA trying to validate challenge %s', filename);

    fs.exists(filename, function (exists) {
      if (!exists) {
        res.writeHead(404, {"Content-Type": "text/plain"});
        res.write("404 Not Found\n");
        res.end();
        return;
      }

      res.writeHead(200);
      fs.createReadStream(filename, "binary").pipe(res);
    });
  }).listen(port);
}

/**
 *  Gets the certificates for the given domain.
 *  Handles all the LetsEncrypt protocol. Uses
 *  existing certificates if any, or negotiates a new one.
 *  Returns a promise that resolves to an object with the certificates.
 *
 */
function getCertificates(domain, email, production, options, logger) {
  if (options && options.info && options.debug) {
    logger = options;
    options = null;
  }

  options = Object.assign({challengeType: 'http-01' }, options);

  var LE = require('letsencrypt');

  // Storage Backend
  var leStore = require('le-store-certbot').create(leStoreConfig);

  // ACME Challenge Handlers
  var leChallenge = require('le-challenge-fs').create({
    webrootPath: webrootPath,
    debug: false
  });

  var le = LE.create({
    server: production ? LE.productionServerUrl : LE.stagingServerUrl,
    store: leStore,                                          // handles saving of config, accounts, and certificates
    challenges: {'http-01': leChallenge},                    // handles /.well-known/acme-challege keys and tokens
    challengeType: options.challengeType,                    // default to this challenge type
    debug: false,
    log: function (debug) {
      console.log('Lets encrypt debugger', arguments)
    }
  });

  // Check in-memory cache of certificates for the named domain
  return le.check({domains: [domain]}).then(function (results) {
    if (results) {
      return results;
    }

    // Register Certificate manually
    return le.register({
      domains: [domain],
      email: email,
      agreeTos: true,
      rsaKeySize: 2048,                                       // 2048 or higher
      challengeType: options.challengeType                    // http-01, tls-sni-01, or dns-01
    }).catch(function (err) {
      logger.error(err, 'Error registering LetsEncrypt certificates');
    });
  });
}

module.exports.init = init;
module.exports.getCertificates = getCertificates;
