'use strict';

var _ = require('lodash');
var crawler = require('simplecrawler');
var fs = require('fs');
var request = require('request');
var robotsParser = require('robots-parser');
var URL = require('url-parse');
var xmlBuilder = require('xmlbuilder');

var RemoteSitemapGenerator = function (url, options) {
    // set default options
    this.defaults = {
        fileName: 'sitemap.xml',
        ignoreQueryStrings: true,
        filePath: './',
        fields: {},
        ignoredFileTypes: ['7z', 'atom', 'bmp', 'css', 'exe', 'gif', 'gz', 'gzip', 'ico', 'jpeg', 'jpg', 'js', 'json', 'mp3', 'mp4', 'ogg', 'pdf', 'png', 'rar', 'rss', 'ttf', 'webm', 'webp', 'woff', 'zip']
    };

    // array for urls
    this.seenUrls = [];

    // check if options are set
    if (options) {
        // merge options with defaults
        this.options = _.merge(this.defaults, options);
    } else {
        this.options = this.defaults;
    };

    // set correct format for priority if it set
    if (this.options.fields.priority) {
        this.options.fields.priority = this.options.fields.priority.toFixed(2);
    }

    this.uri = new URL(url);
    this.crawler = new crawler(this.uri.host);
    this.crawler.initialPath = '/';
    this.crawler.initialPort = '80';

    // check if a protocol was set
    if (!this.uri.protocol) {
        this.uri.set('protocol', 'http:');
    }

    this.crawler.initialProtocol = this.uri.protocol.replace(':', '');
    this.crawler.userAgent = 'Remote-Sitemap-Generator';

    // check if querystrings should be ignored
    if (this.options.ignoreQueryStrings) {
        this.crawler.stripQuerystring = true;
    }

    // set ignored filetypes
    var exts = this.options.ignoredFileTypes.join('|');
    var regex = new RegExp('\.(' + exts + ')', 'i');

    this.crawler.addFetchCondition(function (parsedURL) {
        return !parsedURL.path.match(regex);
    });

    // check for robots.txt
    request(this.uri.set('pathname', '/robots.txt').toString(), (error, response, body) => {
        if (!error && response.statusCode == 200) {
            this.robots = robotsParser(response.request.uri.href, body);
        }

        // start creating the sitemap
        this.createSitemap();
    });
};

/**
 * Generates the sitemap itself
 */
RemoteSitemapGenerator.prototype.createSitemap = function () {
    this.crawler.on('queueadd', (item) => {
        this.addSeenUrl(item.url);
    });

    this.crawler.on('queueduplicate', (URLData) => {
        // get url
        var url = URLData.protocol + '://' + URLData.host + URLData.path;
        this.addSeenUrl(url);
    });

    this.crawler.on('fetch404', (item) => {
        // mark url to be ignored later
        this.ignoreUrl(item.url);

        console.log('Not found: ' + item.url);
    });

    this.crawler.on('fetcherror', (item) => {
        // mark url to be ignored later
        this.ignoreUrl(item.url);

        console.log('Fetch error: ' + item.url);
    });

    this.crawler.on('complete', () => {
        if (_.isEmpty(this.seenUrls)) {
            console.log('Site not found');
            process.exit(1);
        }

        this.write((err, path) => {
            if (err) {
                console.error(err);
                process.exit(1);
            } else {
                console.log('Sitemap created');
            }
        });
    });

    this.crawler.start();
};

/**
 * Writes the sitemap to disk
 * @param  {Function} callback Callback function of type (error, outputPath)
 */
RemoteSitemapGenerator.prototype.write = function (callback) {
    // Filter ignored urls and sort remaining
    this.seenUrls = _.sortBy(_.filter(this.seenUrls, 'ignore', false), 'counter').reverse();

    // variable for urls
    var urlSet = [];

    // options
    var optionFields = this.options.fields;

    // get highest and lowest counter
    var highestCounter = this.seenUrls[0].counter;
    var lowestCounter = this.seenUrls[this.seenUrls.length - 1].counter;
    var stepping = 0.5 / highestCounter;

    var xml = xmlBuilder.create('urlset', {version: '1.0', encoding: 'UTF-8'})
        .att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
        .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
        .att('xsi:schemaLocation', 'http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd');

    // go through urls and prepare urlset
    _.forEach(this.seenUrls, function (seenUrl) {
        var newUrl = {
            loc: seenUrl.url
        };

        // add additional fields
        _.forOwn(optionFields, function (value, key) {
            newUrl[key] = value;
        });

        // check if predefined values are there
        if (!newUrl.priority) {
            newUrl.priority = (seenUrl.counter * stepping) + 0.5;
            newUrl.priority = newUrl.priority.toFixed(2);
        }

        if (!newUrl.changefreq) {
            // set change frequency based on priority
            if (newUrl.priority > 0.9) {
                newUrl.changefreq = 'hourly';
            } else if (newUrl.priority > 0.7) {
                newUrl.changefreq = 'daily';
            } else if (newUrl.priority > 0.6) {
                newUrl.changefreq = 'weekly';
            } else {
                newUrl.changefreq = 'monthly';
            }
        }

        urlSet.push(newUrl);
    });

    _.forIn(urlSet, function (value, key) {
        xml.ele('url')
            .ele(value);
    });

    var sitemap = xml.end({pretty: true, indent: '    ', newline: '\n'});
    var outputPath = this.options.filePath + this.options.fileName;

    fs.writeFile(outputPath, sitemap, function (err) {
        if (typeof callback === 'function') {
            return callback(err, outputPath);
        }
    });
};

/**
 * Set an URL to be ignored
 * @param  {String} url the URL
 */
RemoteSitemapGenerator.prototype.ignoreUrl = function (url) {
    // check if url is already known
    // get location of item
    var index = _.findIndex(this.seenUrls, 'url', url);
    if (index >= 0) {
        this.seenUrls[index].ignore = true;
    }
};

/**
 * Adds an URL to the seen ones. If URL is known already, the counter is increased
 * @param {String} url URL
 */
RemoteSitemapGenerator.prototype.addSeenUrl = function (url) {
    // check if url is already known
    // get location of item
    var index = _.findIndex(this.seenUrls, 'url', url);
    if (index === -1) {
        // check if url should be ignored
        var allowed = true;

        // check if a robots.txt was found, then check if url should be ignored
        if (this.robots) {
            allowed = this.robots.isAllowed(url, this.crawler.userAgent);
            try {
                allowed = this.robots.isAllowed(url, this.crawler.userAgent);
            } catch (e) {
                // everything alright
            }
        }

        if (allowed) {
            this.seenUrls.push({url: url, counter: 1, ignore: false});
            console.log('Found: ' + url);
        } else {
            console.log('Ignored: ' + url);
        }
    } else {
        console.log('Already known: ' + url);
        this.seenUrls[index].counter = this.seenUrls[index].counter + 1;
    }
};

module.exports = function (url, options) {
    return new RemoteSitemapGenerator(url, options);
};
