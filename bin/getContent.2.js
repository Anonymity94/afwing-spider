const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')
const async = require('async')
const iconv = require('iconv-lite')

// 飞机图介
const aircraftJson = require('../doc/aircraft.json')
// 鹰之利爪
const weaponJson = require('../doc/weapon.json')
// 航空百科
const encyclopaediaJson = require('../doc/encyclopaedia.json');
// 战史战例
const warhistoryJson = require('../doc/war-history.json');
// 名机靓影
const picsJson = require('../doc/pics.json')

const URL_VIP = 'http://www.afwing.vip';
const URL_INFO = 'http://www.afwing.info';

let ORIGIN = URL_VIP;

const isRestart = true; // 重新开始

const CATEGORYS = {
  // 'aircraft': aircraftJson, 'weapon': weaponJson,
  'encyclopaedia': encyclopaediaJson,
  // 'war-history':warhistoryJson, 'pics': picsJson
}

let startTime = new Date();

let totalArticleNumber = 0;
for (let key in CATEGORYS) {
  totalArticleNumber += CATEGORYS[key].length
}
console.log('******总文章数*******', totalArticleNumber)
let finishedNumber = 0;

// 消除前后空格
String.prototype.trim = function () {
  return this.replace(/(^\s*)|(\s*$)/g, '')
}

// unicode 转 中文
function decodeUnicode(str) {
  if (!str) 
    return '';
  str = str
    .trim()
    .replace(/(&#x)(\w{1,4});/gi, function ($0) {
      return String.fromCharCode(parseInt(escape($0).replace(/(%26%23x)(\w{1,4})(%3B)/g, '$2'), 16))
    })
  return str
}

function relative2Absolute(path, basePath) {
  // www.baidu/test/public/index.html
  const regexp = /(?:\.\.\/)/g;
  let basePathList = basePath.split('/');

  // /a.jpg
  if (path.charAt(0) === '/') {
    return ORIGIN + path
  }

  const machList = path.match(regexp);

  let machListLength = 0;

  if (machList) {
    machListLength = machList.length;
  }
  // ../a.jpg
  const rest = basePathList.slice(0, basePathList.length - (machListLength + 1));
  rest.push(path.replace(regexp, ''))
  return rest.join('/')
}

// ========爬取文章列表=======
function getContent(originUrl, page = 1, targetDir, articleInfo, callback) {

  // 每30秒轮换一次IP
  if (new Date().getTime() - startTime >= 5 * 1000) {
    ORIGIN = ORIGIN === URL_VIP
      ? URL_INFO
      : URL_VIP;
    startTime = new Date().getTime();
  }

  let totalPage = 1;
  let fullHtml = `<div class="title-wrapper"><h1>${decodeUnicode(articleInfo.title)}</h1><p><span style="margin-right: 20px;">分类：${articleInfo.category}</span><span style="margin-right: 20px;">发布时间：${decodeUnicode(articleInfo.publishTime)}</span><span>作者：${articleInfo.author}</span></p></div>`
  let id = ''

  // 保存文件夹的名称
  const urlList = originUrl.split('/')
  let fileName = urlList[urlList.length - 1].split('.')[0]
  fileName = fileName.replace(/%20/g, '-');

  // 如果已经存在了，不再爬取了
  if (fs.existsSync(`${targetDir}/${fileName}.md`)) {
    console.log('已存在，跳过')
    finishedNumber++;
    console.log('======>已完成文章：', finishedNumber);
    console.log('======>剩余文章：', totalArticleNumber - finishedNumber);
    callback(null, true)
    return false
  }

  let illustrationsDir = `${targetDir}/${fileName}` // 保存插图的目录
  // 新建图片的文件夹
  if (!fs.existsSync(illustrationsDir)) {
    fs.mkdirSync(illustrationsDir)
  }

  polling(page, callback)

  function polling(page, callback) {

    let url = originUrl

    // TODO 判断后缀是htm的网址，单独处理
    // 例如：http://www.afwing.vip/gallery/new_china_aviation_museum/new_china_aviation
    // _ museum-3.htm
    const urlSplit = originUrl.split('.');
    const postfixIsHtm = urlSplit[urlSplit.length - 1] === 'htm';

    if (postfixIsHtm) {
      const name = urlSplit[urlSplit.length - 2];
      // 去掉最后的2位
      const nameSplit = name.split('-');
      if (nameSplit.length > 1) {
        nameSplit[nameSplit.length - 1] = `-${page}`;
      } else {
        nameSplit.push(`-${page}`)
      }

      urlSplit[urlSplit.length - 2] = nameSplit.join('');

      url = urlSplit.join('.');

    } else {
      // 变更url
      if (page !== 1) {
        const urlList = url.split('.html')
        url = urlList[0] + `_${page}.html`
      }

    }

    console.log(url)

    request({
      url, encoding: null // 关键代码
    }, (err, res) => {
      if (err) {
        fs.appendFileSync('error.txt', `${url} 获取失败\n`)
        console.log(`！！！失败`, err)
        console.log(`！！！失败`, originUrl)
        callback(err, false)
        return false;
      }

      console.log(`第 ${page} 页面获取成功`)

      //利用cheerio对页面进行解析
      if (postfixIsHtm) {
        var html = iconv.decode(res.body, 'gb2312');
        var $ = cheerio.load(html, {decodeEntities: false});
      } else {
        var $ = cheerio.load(res.body.toString())
      }

      // 获取插图
      let $imgs = postfixIsHtm
        ? $('body img')
        : $('.article img');
      async.mapLimit($imgs, 10, function (item, callback) {
        downloadImg(item, url, callback)
      }, function (err, result) {
        if (err) {
          console.log(err)
          callback(err, false)
        } else {
          console.log('图片下载完成')

          const $htmlBox = postfixIsHtm
            ? $('body')
            : $('.article')
          // 移除所有的 script 标签
          $htmlBox
            .find('script')
            .remove()
          //  获取content
          let html = $htmlBox.html()
          fullHtml += decodeUnicode(html)

          // 获取总页数
          if (postfixIsHtm) {
            if (page === 1) {
              var regex = /<a.*?>(Part.*?)<\/a>/ig;
              var result = decodeUnicode(html).match(regex);

              if (result && result.length > 0) {
                const pageText = result[result.length - 1].replace(/(<\/?a.*?>)|(<\/?span.*?>)/g, '');
                totalPage = pageText.replace(/[^0-9]/ig, "") * 1
              }
            }
          } else {
            if (page === 1) {
              id = $('.getContent').attr('aid')
              if ($('.pages > label > span').length > 0) {
                totalPage = decodeUnicode($('.pages > label > span').html()).replace(/[^0-9]/ig, "") * 1
              }
            }
          }
          if (page < totalPage) {
            polling(page + 1, callback)
          }
          if (page === totalPage) {
            fs.writeFileSync(`${targetDir}/${fileName}.md`, fullHtml)
            console.log(`${targetDir}/${fileName}.md 写入完成`)
            finishedNumber++;
            console.log('======>已完成文章：', finishedNumber);
            console.log('======>剩余文章：', totalArticleNumber - finishedNumber);
            callback(null, true)
          }
        }
      })

      // 下载图片
      function downloadImg(e, baseUrl, cb) {

        // 如果img标签的父级是 a 标签，去掉它的点击链接
        const parent = $(e).parent()[0];
        if (parent.nodeName === 'A') {
          $(parent).attr('href', 'javascript:;')
        }
        let imgUrl = $(e).attr('src')
        if (!imgUrl) {
          cb(null, true)
          return
        }

        // 取图片的真实路径
        //
        if (imgUrl.indexOf('http') === -1) {
          // 补齐图片路径
          imgUrl = relative2Absolute(imgUrl, baseUrl);
        }
        imgUrl = imgUrl
          .replace('http://www.afwing.com', ORIGIN)
          .replace('http://afwing.com', ORIGIN)
          .replace('http://m.afwing.com', ORIGIN)
        // 截取img 的名称
        const imgPath = imgUrl.split('/')
        let imgName = imgPath[imgPath.length - 1]
        // 去掉 %20 - 等特殊字符
        imgName = imgName.replace(/%20/g, '-')
        // 避免文件名太长，截取一下
        if (imgName.length > 200) {
          imgName = imgName.slice(-50)
        }
        // 替换 img src为本地图片地址
        // TODO
        $(e).attr('src', `./${fileName}/${imgName}`)

        if (!fs.existsSync(`${illustrationsDir}/${imgName}`)) {
          request(imgUrl)
            .pipe(fs.createWriteStream(`${illustrationsDir}/${imgName}`))
            .on('close', function () {
              cb(null, true);
            })
            .on('error', function () {
              console.log('!!!图片路径', imgUrl)
              console.log('!!!图片所在页面', originUrl)
              cb(error, false)
            });
        } else {
          cb(null, true)
        }
      }
    })
  }
}

function init() {

  console.log('❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤')
  console.log(`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}开始`)
  console.log('❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤❤')

  for (let key in CATEGORYS) {
    const targetDir = `./article/${key}`;

    // 如果是重新开始，先删除已存在的目录
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir)
    }
    async
      .mapLimit(CATEGORYS[key], 10, function (item, callback) {
        //最大并发数为5
        const {link} = item
        getContent(link, 1, targetDir, item, callback)
      }, function (err, result) {
        //执行urlArr次后执行
        if (err) {
          console.log(err)
        } else {
          console.log('***********')
          console.log(`${key}处理完成`)
          console.log('***********')
        }
      })
  }
}

// 延时3分钟启动 setTimeout(init, 1000 * 60 * 3)
init()