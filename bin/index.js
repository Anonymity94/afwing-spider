const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');

const ORIGIN = 'http://www.afwing.vip';
// 飞机简介
const url_aircraft = 'http://www.afwing.vip/aircraft/';

// 板块分类
const CATEGORYS = {
    'aircraft': {
        name: '飞机图介',
        totalPage: null, // 总页数
        list: []
    },
    'weapon': {
        name: '鹰之利爪',
        totalPage: null,
        list: []
    },
    'encyclopaedia': {
        name: '航空百科',
        totalPage: null,
        list: []
    },
    'war-history': {
        name: '战史战例',
        totalPage: null,
        list: []
    },
    'pics': {
        name: '名机靓影',
        totalPage: null,
        list: []
    }
}

// unicode编码转换为中文
function decodeUnicode(str) {
    str = str.replace(/(&#x)(\w{1,4});/gi, function ($0) {
        return String.fromCharCode(parseInt(escape($0).replace(/(%26%23x)(\w{1,4})(%3B)/g, "$2"), 16));
    });
    return str;
}

// ========爬取文章列表=======
function getArticleList(categoryKey, page) {

    const categoryName = CATEGORYS[categoryKey].name;

    var url = ORIGIN + '/' + categoryKey + '/';

    if (page !== 1) {
        url += `/index_${page}.html`
    }

    console.log(`开始抓取，${categoryName} 第 ${page} 页内容....`)

    return request(url, (err, res) => {
        if (err) {
            consoel.log(`！！！${categoryName} 第 ${page} 页失败`, err);
            return;
        }
        //利用cheerio对页面进行解析
        var $ = cheerio.load(res.body.toString());

        // 取到第一页时，获取总页数
        if (page === 1) {
            const pageText = $('.content .pages')
                .find('label > span')
                .attr('title');

            CATEGORYS[categoryKey].totalPage = Number(pageText.replace(/共/, '').replace(/页/, ''))
        }

        const articleList = [];
        $('.content .left_list > li').each(function () {

            const obj = {};
            const $this = $(this);

            // 排除分页
            if ($this.hasClass('pages')) 
                return;
            
            // 分类
            obj.category = categoryName;
            // 封面
            const thumb = $this
                .find('>a>img')
                .attr('src');
            obj.thumb = ORIGIN + thumb;
            // 标题
            obj.title = decodeUnicode($this.find('a.title').html());
            // 原文链接
            const link = $this
                .find('a.title')
                .attr('href');
            obj.link = ORIGIN + link;
            // 简述
            obj.summary = decodeUnicode($this.find('.content_txt > p').html());

            // tips： 图波列夫 |2018-02-24 | 忘情
            var tips = $(this)
                .find('.tips')
                .text();

            // 发布时间
            obj.publishTime = tips.split('|')[1];
            obj.author = tips.split('|')[2];

            articleList.push(obj);
        })

        console.log(`抓取成功`)
        CATEGORYS[categoryKey].list = [
            ...CATEGORYS[categoryKey].list,
            ...articleList
        ];

        if (page < CATEGORYS[categoryKey].totalPage) {
            getArticleList(categoryKey, page + 1)
        }

        if (page === CATEGORYS[categoryKey].totalPage) {
            fs.appendFileSync(`./doc/${categoryKey}.json`, JSON.stringify(CATEGORYS[categoryKey].list));
            console.log(`./doc/${categoryKey}.json 保存成功`)
        }

        console.log('=========')

    })
}

function init() {

    const keys = Object.keys(CATEGORYS);

    keys.forEach(key => {
        // 先删除原来的文件
        const filePath = `./doc/${key}.json`;
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
        getArticleList(key, 1)
    })
}

init();