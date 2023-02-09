const config = {
	// data
	category: {
		'aircraft': {
			name: '飞机图介',
			list: []
		},
		'weapon': {
			name: '鹰之利爪',
			list: []
		},
		'encyclopaedia': {
			name: '航空百科',
			list: []
		},
		'war-history': {
			name: '战史战例',
			list: []
		},
		'pics': {
			name: '名机靓影',
			list: []
		}
	},
	// page element ids
	nav_id: '#nav',
	content_id: "#content",
	back_to_top_id: "#back_to_top",
	loading_id: "#loading",
	error_id: "#error",

	save_progress: true, // 保存阅读进度

	appRout: '',

	document_title: '空军之翼',
	index: 'afwing-spider/index.html', // 首页

	run: initialize
}

/**
 * 获取当前hash
 *
 * @param {string} hash 要解析的hash，默认取当前页面的hash，如： nav#类目 => {nav:nav, anchor:类目}
 * @description 分导航和页面锚点
 * @return {Object} {nav:导航, anchor:页面锚点}
 */
var getHash = function(hash) {
	hash = hash || window.location.hash.substr(1);

	if(!hash) {
		return {
			nav: '',
			anchor: ''
		}
	}

	hash = hash.split('#');
	return {
		nav: hash[0],
		anchor: decodeURIComponent(hash[1] || '')
	}
};

function allArticle() {
	var all = [];
	for(let key in config.category) {
		all.push(...config.category[key].list)
	}

	return all;
}

function show_error() {
	console.log("SHOW ERORR!");
	$(config.content_id).html('Oops! ... Not found!');
}

function show_loading() {
	$(config.content_id).html('Loaidng');
}

//   根据分类获取文章列表
function getArticleListByCategory(categoryId) {

	if(config.category[categoryId].list.length > 0) {
		return config.category[categoryId].list;
	}
	var result = [];
	// 同步执行
	$.ajaxSettings.async = false;
	$.getJSON(`${config.appRout}/doc/${categoryId}.json`, function(data) {
		result = Array.isArray(data) ? data : []
		config.category[categoryId].list = result;
	})

	return result;
}

function renderArticleList(categoryId) {
	if(!categoryId) {
		show_error()
		return;
	}
	const list = getArticleListByCategory(categoryId);

	if(list.length === 0) {
		$(config.content_id).html('Empty')
	} else {
		$(config.content_id).empty();

		var html = '';
		html += `<h5 style="text-align:center">${config.category[categoryId].name}&nbsp;&nbsp;<span class="badge badge-pill badge-info">${config.category[categoryId].list.length}</span></h5>`

		html += '<ul class="list-group">';
		list.forEach(function(item) {
			// 只保留最后的一个字段
			var nameList = item.link.split('/');
			var name = nameList[nameList.length - 1].split('.')[0].replace(/%20/g, '-').replace(/&/g, '-')

			// 展示所有的分类
			html += '<li class="list-group-item d-flex justify-content-between align-items-center">';
			html += `<a href="index.html#article/${categoryId}/${name}">${item.title}</a>`;
			html += `<span class="badge">${item.publishTime}</span>`;
			html += '</li>'
		})
		html += '</ul>';

		$(config.content_id).append(html);
	}
}

// 获取文章内容
function renderArticleContent(categoryId, articlePath) {
	// 获取文章的所在分类的内容
	var list = getArticleListByCategory(categoryId);

	$.get(articlePath, function(data) {
		$(config.content_id).html(marked(data.replace(/' '/g, '')));

		// 处理图片的链接地址
		normalize_paths();

		// 移除 Partx 导航条
		var regexA = /<a.*?>(Part.*?)<\/a>/ig;
		$('.content a').each(function() {
			if(this.outerHTML.match(regexA)) {
				$(this).remove();
			}
		})

		var nav = getHash().nav;
		// 获取文章的详情
		var meta = list.find(item => {
			return(item.link.replace(/%20/g, '-').replace(/&/g, '-')).indexOf(nav.replace('article/', '').replace(categoryId, '')) > -1;
		})
		// 修改a标签的跳转
		const a = $(config.content_id + " a");
		a.each(function() {
			var _this = $(this);
			var href = _this.attr('href');
			if(href.slice(0, 4) !== "http") {
				href = href.slice(0, -5)
			} else {
				href = href.slice(0, -4)
			}
			const flag = list.find(item => item.link.indexOf(href) > -1);
			if(flag) {
				_this.attr('href', `index.html#article${href}`)
			} else {
				if(href.indexOf('http://www.afwing.com') > -1) {
					_this.attr('href', `index.html#article${href.replace('http://www.afwing.com','')}`)
				}
				if(href.indexOf('http://www.afwing.info') > -1) {
					_this.attr('href', `index.html#article${href.replace('http://www.afwing.info','')}`)
				}
			}

		})

		// 添加原文链接地址
		meta && $('.title-wrapper > p').append(`<span><a target="_blank" href="${meta.link}" style="margin-left: 20px;">查看原文</a></span>`)

		//更改网页标题
		if($(config.content_id + " .title-wrapper h1").text() === config.document_title) {
			document.title = config.document_title;
		} else {
			document.title = $(config.content_id + " .title-wrapper h1").text() + " - " + config.document_title;
		}

	}).fail(function() {
		show_error();
	}).always(function() {});
}

function normalize_paths() {
	// images
	$(config.content_id + " img").map(function() {
		var src = $(this).attr("src").replace("./", "");
		// 屏蔽 img 标签上层的 a 标签链接地址
		if($(this).parent()[0].nodeName === "A") {
			$(this).parent().attr('href', 'javascript:;')
		}

		if($(this).attr("src").slice(0, 4) !== "http") {
			var pathname = location.pathname.substr(0, location.pathname.length - 1);

			//取图片的名称
			var imgList = src.split('/');

			// normalize the path (i.e. make it absolute)
			$(this).attr("src", config.appRout + '/' + getHash().nav + '/' + imgList[imgList.length - 1]);
		}
	});
}

function router() {
	show_loading();

	// 解析hash
	var nav = getHash().nav;
	if(!nav) {
		// 以第一个处理分类处理
		renderArticleList(Object.keys(config.category)[0]);
		return;
	}
	var navList = nav.split('/');

	// 渲染文章列表
	if(navList.length === 2) {
		if(navList[0] === 'category' && config.category.hasOwnProperty(navList[1])) {
			renderArticleList(navList[1])
		} else {
			show_error();
		}
	}
	// 渲染文章内容
	else if(navList.length >= 3) {
		// 滑动到顶部
		$('html, body').animate({
			scrollTop: 0
		}, 300);
		if(navList[0] === 'article' && config.category.hasOwnProperty(navList[1])) {
			var articlePath = `${config.appRout}/${nav}.md`;
			renderArticleContent(navList[1], articlePath);
		} else {
			show_error()
		}
	} else {
		show_error()
	}

}

function initialize() {

	// 处理 nav 导航栏
	Object.keys(config.category).forEach(function(key) {
		const name = config.category[key].name;
		$(config.nav_id).append(`<a><a class="p-2 text-dark" href="index.html#category/${key}">${name}</a></a>`)
	})
	// page router
	router();
	$(window).on('hashchange', router);

	$(document).ready(function() {

		//为当前窗口添加滚动条滚动事件（适用于所有可滚动的元素和 window 对象（浏览器窗口））
		$(window).scroll(function() {
			//创建一个变量存储当前窗口下移的高度
			var scroTop = $(window).scrollTop();
			//判断当前窗口滚动高度
			//如果大于100，则显示顶部元素，否则隐藏顶部元素
			if(scroTop > 100) {
				$('#backTop').fadeIn(500);
			} else {
				$('#backTop').fadeOut(500);
			}
		});

		//为返回顶部元素添加点击事件
		$('#backTop').click(function() {
			//将当前窗口的内容区滚动高度改为0，即顶部
			$("html,body").animate({
				scrollTop: 0
			}, "fast");
		});
	})

}

config.run();