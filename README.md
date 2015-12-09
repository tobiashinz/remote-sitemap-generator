# Node Remote Sitemap Generator

## Installation

```bash
npm install --save remote-sitemap-generator
```

## Usage
```node
var remoteSitemapGenerator = require('remote-sitemap-generator');
remoteSitemapGenerator(<url> [, options]);
```
## Options
Options are passed to the function as an object. The `priority` and `changefreq` of every link is calculated based on the amount ob internal links to a specific url. This can be overwritten by passing over the respective attributes in the `fields` object.

### fields
Any key-value-pair you set will be added to the `<url>` in the sitemap.

*Example*:

```node
var remoteSitemapGenerator = require('remote-sitemap-generator');
remoteSitemapGenerator(<url>, {fields: {priority: 1.0, changefreq: 'daily'}});
```

### fileName
The output filename of the sitemap. Default: `sitemap.xml`

### filePath
Location where sitemap will be saved to. Default: `./`

### ignoredFileTypes
Urls to files with these extensions will be ignored. Default: `['7z', 'atom', 'bmp', 'css', 'exe', 'gif', 'gz', 'gzip', 'ico', 'jpeg', 'jpg', 'js', 'json', 'mp3', 'mp4', 'ogg', 'pdf', 'png', 'rar', 'rss', 'ttf', 'webm', 'webp', 'woff', 'zip']`

### ignoreQueryStrings
Whether or not querystring in urls will be ignored. Default: `true`