/**
* author: zhoumm (http://www.mzhou.me)
* version：1.2
* license: MIT or GPL license
*/
(function () {
	var CEN_WD = 35;// 中点纬度
	var CEN_JD = 105;// 中点经度
	var CEN_X = 0;
	var CEN_Y = 0;
	var A1 = 6371000000.00;// 地球半径
	var PII = Math.PI / 180;
	var k = (Math.log(Math.sin(25 * PII)) - Math.log(Math.sin(47 * PII)))/ (Math.log(Math.tan(30 / 2.00 * PII)));
	
	//兰伯特投影函数
	lambert2xy = function(latitude, longitude, scale) {
		var fai = latitude;
		var lamda = longitude;
		var xa = A1 / (2 * scale * k);
		var a1 = 15 * PII;
		a1 = Math.tan(a1);
		a1 = Math.pow(a1, k);
		var l1 = xa / a1;
		a1 = (45.00 - fai / 2.00) * PII;
		a1 = Math.tan(a1);
		a1 = Math.pow(a1, k);
		var a3 = xa * Math.pow(Math.tan((45 - 30 / 2) * PII) / Math.tan(CEN_WD / 2.00 * PII), k);
	
		var xx = CEN_X + (l1 * a1 * Math.sin(k * (lamda - CEN_JD) * PII)) * 1.000;
		var yy = CEN_Y + (a3 - l1 * a1 * Math.cos(k * (lamda - CEN_JD) * PII)) * 1.0;
		// 符合svg坐标
		yy = 0 - yy;
		xx = xx + 530; // 中点坐标移动485
		yy = yy + 360; // 中点坐标移动 经测试420 300是中国地图合适的位置
		return [xx, yy];
	}
	//实现对函数的缓存
	memorize = function(fun) {
			var cache = {};
			var slice = Array.prototype.slice;
			var f = function(){
				var key = slice.call(arguments, 0).join();
				if (cache[key] === undefined)
					cache[key] = fun.apply(this,arguments);
				return cache[key];
			};
			f.clearCache = function() {
				cache = {};
			};
			f.addCache = function(key,value) {
				cache[key] = value;
			};
			f.removeCache = function(key) {
				delete cache[key];
			};
			return f;
	}
	lambert2xy = memorize(lambert2xy);
})();

var Map = (function ($) {

var M = function() {
		//初始化过程为：附加svg标签 => 载入地图 => 执行初始化操作。后一步必须在前一步结束后执行
		return attachSVG.apply(M, arguments); 
	};
var svgWrapper; //SVG Wrapper Object
var svgContainer; //SVG container,jquery对象
var svgRoot; //SVGRoot object,dom对象
var mousedownX = 0;
var mousedownY = 0;
var maxWidth; //svg地图容器宽度
var maxHeight;//svg地图容器高度
var mapX;
var mapY;
var dragStart = false; //是否开始拖动
var mask;//地图前面一层
var info;//动态显示消息的svgMapInfo(DOM元素)
var map;//地图层
var zoomCircle;//用于指示放大或缩小的区别
var scaleCache;
var zooming = false;
M.prototype.version = "1.1.0";

//附加SVG标签，并初始化地图
//@param:svgPic SVGWrapperObject
//@param:mapUrl String:地图图片的url
//@param:initPath String:blank.svg图片的路径
//@param:x viewbox的x值
//@param:y viewbox的y值
//@param:afterMapLoaded 在地图载入完成后执行
//@param:option 选项  具体值：width:设置容器的宽度,height:容器高度，zoomOutCallBack:缩小时回调函数，zoomInCallBack:放大时回调函数，restMapCallBack:重置时回调函数；
//@return: -
var attachSVG = function(selector, mapUrl, initPath, x, y, afterMapLoaded, option) {
	var s = $(selector);
	if (s.width()<=0 || s.height()<=0) {
		if (option && option['width'] && option['height']) {
			$(selector).width(option['width']);
			$(selector).height(option['height']);	
		}
		else {
			throw "Must set the container's width and height!";
		}
	}
	
	s.svg({
		initPath:initPath,
		onLoad:function() { 
			//必须在这初始化参数，否则IE下会失效，因为SVG初始化在IE下需要时间
			init(selector,mapUrl,afterMapLoaded,x,y); //jquery object
			delete option['width'];
			delete option['height'];
			option && $.extend(M.prototype, option);
		}
	});
}

//载入地图图片,初始化参数
//@param:selector String:选择符
//@param:mapUrl String:地图图片的url
//@return: -
var init = function(selector, mapUrl,afterMapLoaded, x, y) {
		if (typeof selector == "undefined" || typeof mapUrl == "undefined") {
			throw "init Error:svg is undefined!";
		}
		svgWrapper = $(selector).svg('get');//SVG wrapper object
		svgWrapper.configure({'xmlns':'http://www.w3.org/2000/svg','xmlns:xlink':'http://www.w3.org/1999/xlink'}, false);
    		svgContainer = $(svgWrapper._container);
		svgRoot = svgWrapper.root();//root SVG element
		maxWidth = svgWrapper._width();
		maxHeight = svgWrapper._height();
		mapX = x;
		mapY = y;
		//在IE下必须指定xmlns,否则序列化存在问题
		var mapLevel = svgWrapper.svg(0,0, maxWidth, maxHeight, x, y, maxWidth, maxHeight, {'xmlns':'http://www.w3.org/2000/svg','xmlns:xlink':'http://www.w3.org/1999/xlink'});
		if ($.browser.msie)
			mapLevel.removeAttribute('xmlns:xmlns');
		svgWrapper.loadMapToElement(mapLevel, mapUrl, {
		                addTo:true,
		                changeSize: false,
		                onLoad: function (svgg, error) {
						//TODO ：载入完成之后需要做的事!
						map = mapLevel;
			                        mask = svgWrapper.group("svgMapMask");
			                        zoomCircle = svgWrapper.circle(mask, 0, 0, 0,{fill:'none',stroke:'red',strokeWidth:'1',opacity:0.0});
			                        mapBinding(selector);
			                        afterMapLoaded && afterMapLoaded.apply(M.prototype,[maxWidth,maxHeight]);
				}}
		);
};

//将地图的viewBox值设置成mapX mapY maxWidth maxHeight
//@return: -
var resetMap = function() {
	stopAnimation();
	map.setAttribute('viewBox',mapX+' '+mapY+' ' + maxWidth + " " +maxHeight);
	M.prototype.restMapCallBack && M.prototype.restMapCallBack.apply(this, [svgWrapper, svgRoot, svgContainer]);
};

//停止地图的动画
//@return: -
var stopAnimation = function() {
        //停止地图的变化
	$(map).stop(true);
        //停止zoomCircle的动画
        $(zoomCircle).stop(true);
        //使zoomCircle消失
        svgWrapper.change(zoomCircle,{cx:0,cy:0,opacity:0.0});
};

//去的浏览器可视口的宽高，并设置为地图的宽高，配合其他操作完成最大化
//@return -
var maxMap = function() {                
	var de=document.documentElement;
        var db=document.body;
	var w=de.clientWidth==0 ?  db.clientWidth : de.clientWidth;
	var h=de.clientHeight==0 ?  db.clientHeight : de.clientHeight;
	setWH(w,h);
}

//设置地图的容器宽高、地图宽高、地图viewBox的宽高，（重新设置宽和高时，地图的viewBox必须和地图的宽高保持一致否则拖放和缩放操作会产生误差）
//@param:w String:宽
//@param:h String:高
//@return -
var setWH = function(w,h) {
	maxWidth = w;
	maxHeight = h;
	svgContainer[0].setAttribute('width',maxWidth);
	svgContainer[0].setAttribute('height',maxHeight);
	if ($.browser.msie) {
		var embed = svgContainer.children('embed');
		embed[0].setAttribute('width',maxWidth);
		embed[0].setAttribute('height',maxHeight);
	}
	svgRoot.setAttribute('width',maxWidth);
	svgRoot.setAttribute('height',maxHeight);
	map.setAttribute('width',maxWidth);
	map.setAttribute('height',maxHeight);
	resetMap();
}

//上下左右移动地图
//@param:percent number:移动原宽/高的比例
//@param:time number:移动所花的时间
//@param:direction String:"up/down/left/right"
//@return: -
var moveMap = function(percent, time, direction) {
	var viewBox = parseViewBox(map.getAttribute('viewBox'));
	if (direction === "up") {
		viewBox[1] -= viewBox[3]*percent;
		$(map).animate({svgViewBox:viewBox.join(" ")}, time);
	}
	else if (direction === "down") {
		viewBox[1] += viewBox[3]*percent;
		$(map).animate({svgViewBox:viewBox.join(" ")}, time);
	}
	else if (direction === "left") {
		viewBox[0] -= viewBox[2]*percent;
		$(map).animate({svgViewBox:viewBox.join(" ")}, time);
	}
	else if (direction === "right") {
		viewBox[0] += viewBox[2]*percent;
		$(map).animate({svgViewBox:viewBox.join(" ")}, time);
	}
}

//放大
//@param:percent number:缩小的百分比
//@param:time string:缩放所花时间
//@param:event object:事件
//@param:central boolean:是否需要将鼠标所指的点，在放大时移动到地图中心
//@return: -
var zoomIn = function(percent,time,event,central) {
	if (zooming)
		return;
	zooming = true;
        M.prototype.stopAnimation();
        animateViewBox(percent,time,event,central,true);
	M.prototype.zoomInCallBack && M.prototype.zoomInCallBack.apply(this, [svgWrapper, svgRoot, svgContainer, percent,time]);
	setTimeout(function() {
		zooming = false;
	},time);
};

//缩小
//@param:percent number:放大的缩小的百分比
//@param:time string:缩放所花时间
//@param:event object:事件
//@return: -
var zoomOut = function(percent,time,event) {
	if (zooming)
		return;
	zooming = true;
        M.prototype.stopAnimation();
        animateViewBox(percent,time,event,false,false);
	M.prototype.zoomOutCallBack && M.prototype.zoomOutCallBack.apply(this, [svgWrapper, svgRoot, svgContainer, percent,time]);
	setTimeout(function() {
		zooming = false;
	},time);
};

//放大和缩小的动画效果的算法实现(计算得到偏离值)
//@param:percent number:缩小的百分比
//@param:time string:缩放所花时间
//@param:event object:事件
//@param:central boolean:是否需要将鼠标所指的点，在放大时移动到地图中心
//@param:zoomIn boolean:是否是放大操作
//@return -
var animateViewBox = function(percent,time,event,central,zoomIn) {
        var viewBox = parseViewBox(map.getAttribute('viewBox'));  
        var r = caculateXYX2Y2(percent,event,central,zoomIn,viewBox);
        setAnimate(viewBox,r[0],r[1],r[2],r[3],time);
};

var caculateXYX2Y2 = function(percent,event,central,zoomIn,viewBox) {
    var x,y,x2,y2; //x2,y2是viewBox[3]和viewBox[4]的偏移量，x,y是viewBox[0]和viewBox[1]的偏移量
    //以地图中心点为中心放大的情况
    if (!event) {
            //判断是放大还是缩小
            zoomIn ? (x2=viewBox[2]*percent)&&(y2=viewBox[3]*percent) : (x2=-viewBox[2]*percent)&&(y2=-viewBox[3]*percent);
            x = x2/2;
            y = y2/2;
    }
    else {
//    	var scaleCache = Math.max(viewBox[2]/maxWidth, viewBox[3]/maxHeight);
    	scaleCache = viewBox[3]/maxHeight;
	
            //event.pageX和event.pageY是鼠标相对于页面的绝对位置，不是相对于容器的绝对位置
            var pointX = event.pageX -parseFloat(svgContainer.offset().left); //相对于容器的绝对位置
            var pointY = event.pageY -parseFloat(svgContainer.offset().top); //相对于容器的绝对位置
            //是否移动鼠标点到中心点，然后以中心点为中心放大
            if (central) {
                    var offsetX = (pointX - maxWidth/2)*scaleCache;
                    var offsetY = (pointY - maxHeight/2)*scaleCache;
                    //移动鼠标点到中点
                    viewBox[0] += offsetX;
                    viewBox[1] += offsetY;
                            
                    //判断是放大还是缩小
                    zoomIn ? (x2=viewBox[2]*percent)&&(y2=viewBox[3]*percent) : (x2=-viewBox[2]*percent)&&(y2=-viewBox[3]*percent);
                    x = x2/2;
                    y = y2/2;
            }
            //以鼠标点位中心放大
            else {
                    //判断是放大还是缩小
                    zoomIn ? (x2=viewBox[2]*percent)&&(y2=viewBox[3]*percent) : (x2=-viewBox[2]*percent)&&(y2=-viewBox[3]*percent);
                    x = (pointX/maxWidth)*x2;
                    y = (pointY/maxHeight)*y2;
            }
    }
    return [x,y,x2,y2];
}
caculateXYX2Y2 = memorize(caculateXYX2Y2);
	
//设置视口值到viewBox上，并且使用jQuery.animate实现动画效果
//@param:viewBox
//@prarm:x
//@prarm:y
//@param:x2
//@param:y2
//@prarm:time
var setAnimate = function(viewBox, x, y, x2, y2,time) {
        viewBox[0] += x;
        viewBox[1] += y;
        viewBox[2] -= x2;
        viewBox[3] -= y2;
        $(map).animate({svgViewBox:viewBox.join(" ")}, time);
};

//处理vewBox属性值，返回length为4的数组
//@param:value 字符串：空格隔开的字符串
//@return:数组
var parseViewBox = function(value) {
		var viewBox = value.split(' ');
		for (var i = 0; i < 4; i++) {
			viewBox[i] = parseFloat(viewBox[i]);
		}
		return viewBox;
};

//鼠标滑轮的事件处理函数，上滚时delta为1，下滚时delta为-1
//@param:dom DOM元素： 绑定事件处理的DOM元素,选择符
//@return: -
var mapBinding = function(dom) {
    //去除现有的鼠标移动、鼠标按下、鼠标松开的事件处理，防止浏览器的已存在的拖曳
	jQuery(svgRoot).bind('mousemove',function(e) {return false});
	jQuery(svgRoot).bind('mousedown',function(e) {return false});	
	jQuery(svgRoot).bind('mouseup',function(e) {return false});
	// 设置滑轮滚动的ie下处理
	jQuery(dom).bind('mousewheel', function(e){
		if (e.wheelDelta == 120)
			M.prototype.zoomIn(0.3, 500,e) || zoomAnimation(1000, e, true);
		else if (e.wheelDelta == -120)
			M.prototype.zoomOut(0.3, 10,e) || zoomAnimation(1000, e, false);
	});
	// 设置滑轮滚动的firefox下处理
	jQuery(dom).bind('DOMMouseScroll', function(e){
		if (e.detail == -3)
			M.prototype.zoomIn(0.3, 500, e) || zoomAnimation(1000, e, true);
		else if (e.detail == 3)
			M.prototype.zoomOut(0.3, 10, e) || zoomAnimation(1000, e, false);
	});
	// 设置双击事件处理
	if ($.browser.msie) {
		// ie下注入脚本实现双击事件处理
		svgWrapper.script("function mapdblclick_ie(e) {if(e.getDetail() == 2) {Map.prototype.zoomInForAdobeSVG(0.4, 500, e);}}");
		svgWrapper.change(map, {"onclick":"mapdblclick_ie(evt);"});
	}
	else {
		jQuery(map).dblclick(function(e) {M.prototype.zoomIn(0.4, 500, e, true);});
	}
	// 设置鼠标进入事件处理
	jQuery(svgRoot).mouseover(function(e) {
		noScroll();
	});
	// 设置鼠标离开事件处理
	jQuery(svgRoot).mouseleave(function(e) {
		scrollable();
	});
	// 设置鼠标按下事件处理
	jQuery(svgRoot).mousedown(function(e) {
		//设置X和Y和dragStart
		mousedownX = e.pageX;
		mousedownY = e.pageY;
		dragStart = true;
		var viewBox = parseViewBox(map.getAttribute('viewBox'));
		scaleCache = viewBox[3]/maxHeight;
		//ASV3.0还不支持cursor属性,必须在root元素上使用
		$(map).attr('style','cursor:move');
	});
	// 设置鼠标移动事件处理
	jQuery(svgRoot).mousemove(function(e) {
		if (dragStart) {
			//计算偏移量，重新设置SVG图片
			var offsetX = e.pageX - mousedownX;
			var offsetY = e.pageY - mousedownY;
			var viewBox = parseViewBox(map.getAttribute('viewBox'));
			viewBox[0] -= (offsetX*scaleCache);
			viewBox[1] -= (offsetY*scaleCache);
			mousedownX = e.pageX;
			mousedownY = e.pageY;
			map.setAttribute('viewBox',viewBox.join(" "));
		}	
	});
	// 设置鼠标抬起事件处理
	jQuery(svgRoot).mouseup(function(e) {
		//ASV3.0还不支持cursor属性,必须在root元素上使用
		dragStart ? !(dragStart = false) && $(map).attr('style','cursor:auto') : 0;
	});
};


//显示放大缩小操作时的动画
//@param:time number:动画的时间
//@param:event object:jQuery事件
//@param:zoomIn boolean:是否是放大
//@return: true
var zoomAnimation = function(time, event, zoomIn) {
        //获得视口坐标和大小
        var viewBox = parseViewBox(map.getAttribute('viewBox'));
        var pointX = event.pageX -parseFloat(svgContainer.offset().left); //相对于容器的绝对位置
		var pointY = event.pageY -parseFloat(svgContainer.offset().top); //相对于容器的绝对位置
        var radius = 35;
        var circleWidth = 1;
        
        if (zoomIn) {
                svgWrapper.change(zoomCircle, {cx:pointX, cy:pointY, r:0, fill:'none', stroke:'red', strokeWidth:circleWidth, opacity:1.0});
                setTimeout(function() {
                        svgWrapper.change(zoomCircle,{opacity:0.0});
                },time);
                $(zoomCircle).animate({svgR:radius,svgOpacity:0.0},time);
        }
        else {
                svgWrapper.change(zoomCircle, {cx:pointX, cy:pointY, r:radius, fill:'none', stroke:'red', strokeWidth:circleWidth, opacity:1.0});
                setTimeout(function() {
                        svgWrapper.change(zoomCircle,{opacity:0.0});
                }, time);
                $(zoomCircle).animate({svgR:0,svgOpacity:0.0},time);
        }
};

//获得鼠标所在位置在SVG文档中的绝对位置
//@param:event object:jQuery事件
//@param:viewBox array[4]:viewBox值
//@return: position arrary[2]:表示坐标
var getAbsolutePosition = function (event,viewBox) {
        //获得鼠标相对于容器的绝对位置
        var pointX = event.pageX -parseFloat(svgContainer.offset().left); //相对于容器的绝对位置
        var pointY = event.pageY -parseFloat(svgContainer.offset().top); //相对于容器的绝对位置
        var position = [];
		scaleCache = viewBox[3]/maxHeight;
        position[0] = viewBox[0] + pointX*scaleCache;
        position[1] = viewBox[1] + pointY*scaleCache;
        return position;
};

var noScroll = function () {
	//IE6滚动条的隐藏显示会引起页面偏移，所以在外层加了一个ID为scroll的TD来适应页面,宽度为17px;
	$("#map_scroll").css("display",""); //用于防止滚动条隐藏后，页面右移，#map_scroll是添加的空白，用于防止右移
	$('body').attr('style', 'overflow-y:hidden');
};

var scrollable = function () {
	//IE6滚动条的隐藏显示会引起页面偏移，所以在外层加了一个ID为scroll的TD来适应页面,宽度为17px;
	$("#map_scroll").css("display","none");
	dragStart ? dragStart = false : 0;
	$('body').removeAttr('style');
};


var updateMapInfo = function() {
        var viewBox = parseViewBox(map.getAttribute('viewBox'));
        $(info).html("Scale:" + viewBox[2] + "/" + maxWidth +"<br>");
}

//专为鼠标点击放大设计的操作（只能用于AdobeSVG）
//@param:percent number:放大比例
//@param:time number:所需时间
//@param:event domObejctEvent:dom事件
//@return: -
var zoomInForAdobeSVG = function(percent,time,event) {
	if (zooming)
		return;
	zooming = true;
        M.prototype.stopAnimation();        
        var viewBox = parseViewBox(map.getAttribute('viewBox'));
        //按鼠标点位置为中心放大
        //event是原生的SVG事件，根据标准event.clientX是鼠标相对于SVG容器的绝对位置
        scaleCache = viewBox[3]/maxHeight; //TODO 可以优化
        var offsetX = (event.clientX - maxWidth/2)*scaleCache;
        var offsetY = (event.clientY - maxHeight/2)*scaleCache;
        viewBox[0] += offsetX;
        viewBox[1] += offsetY;
        
        var x2 = viewBox[2]*percent;
        var x = x2/2;
        var y2 = viewBox[3]*percent;
        var y = y2/2;
        setAnimate(viewBox,x,y,x2,y2,time);
    	M.prototype.zoomInCallBack && M.prototype.zoomInCallBack.apply(this, [svgWrapper, svgRoot, svgContainer, percent,time]);
        setTimeout(function() {
		zooming = false;
	},time);
};

//计算鼠标相对于页面的相对坐标
//@param:e domObejctEvent：dom事件
//@return:[x,y] array:坐标
var getCoordInDocument = function(e) {
    e = e || window.event;
    var doc = document.documentElement, body = document.body;
	var x = e.pageX || (e.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc.clientLeft || 0));
	var y = e.pageY || (e.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc.clientTop || 0));

    return [x,y];
};

//在地图中添加新的text，image，point
//@param:movable boolean:是否需要随地图放大缩小
//@param:type 插入的元素类型：text/image/circle
//@param:data text/image/circle:插入的元素
//text data {x:10,y:10,text:'text',color:'blue',size:'10'}
//image data {x:10,y:10,w:16,h:16,imageUrl:'map.svg',click_fn:function(){},over_fn:function(){},leave_fn:function(){}}
//circle data {x:10,y:10,r:10,fillColor:'blue',strokeColor:'red',strokeWidth:'black',click_fn:function(){},id:'id',
//             over_fn:function(){},leave_fn:function(){}}
var addThing = function(movable, type, data) {
	var parent;
	movable ? parent = map : parent = mask;
	addThingToParent(parent, type, data);
};

//在地图中添加新的text，image，point
//@param:parent 父dom
//@param:type 插入的元素类型：text/image/circle
//@param:data text/image/circle:插入的元素
//text data {x:10,y:10,text:'text',color:'blue',size:'10'}
//image data {x:10,y:10,w:16,h:16,imageUrl:'map.svg',click_fn:function(){},over_fn:function(){},leave_fn:function(){}}
//circle data {x:10,y:10,r:10,fillColor:'blue',strokeColor:'red',strokeWidth:'black',click_fn:function(){},id:'id',
//             over_fn:function(){},leave_fn:function(){}}
var addThingToParent = function(parent, type, data) {
	if (type === "text") {
		return svgWrapper.text(parent, data.x, data.y, data.text, {fill: data.color, 'font-size':data.size});
	}
	else if (type === "image") {
		//必须是绝对uri，故转换
        if (data.imageUrl.indexOf("http://") == -1) {
        	var lastDash = document.URL.lastIndexOf("/");
        	var secondLastDash = document.URL.substring(0,lastDash).lastIndexOf('/');
        	if (data.imageUrl.search(/\//) == -1)
        		data.imageUrl = document.URL.substring(0,lastDash) + "/" + data.imageUrl;
        	else if (data.imageUrl.indexOf("/") == 2)
        		data.imageUrl = document.URL.substring(0,secondLastDash) + data.imageUrl.substring(2);
        	else if (data.imageUrl.indexOf("/") == 1)
        		data.imageUrl = document.URL.substring(0,lastDash) + data.imageUrl.substring(1);
        }
		return svgWrapper.image(parent, data.x, data.y, data.w, data.h, data.imageUrl,
				{onclick:data.click_fn, onmouseover:data.over_fn, onmouseout:data.leave_fn});
	}
	else if (type === "circle") {
		return svgWrapper.circle(parent, data.x, data.y, data.r,
				{fill: data.fillColor, stroke: data.strokeColor, strokeWidth:data.strokeWidth, onclick:data.click_fn, id:data.id, 
				onmouseover:data.over_fn, onmouseout:data.leave_fn});
	}
};

var removeThing = function(source) {
        typeof source != "undefined" && source != null && (svgWrapper.remove(source) || (source = null));
}

//光栅化SVG图片
//@param:type String：图片类型（.jpg/.png）
//@param:quality String:位数（0.8）
var rasterize = function(type, quality, urlCallBack, url) {
	var svgString = svgWrapper.toSVG(map);
	var type = "?type=" + type;
	var quality = "&quality=" + quality;//TODO
	var width = "&width=" + maxWidth;//TODO
	var height = "&height=" + maxHeight;//TODO
	var viewBox = "&viewBox=" + map.getAttribute('viewBox');//map.getAttribute('viewBox');
	var parameter = type + quality + width + height + viewBox;
	function callBack(msg) {
		if (msg == "")
			alert('截取图像失败！');
		else
			window.open(urlCallBack + "?name=" + msg);
	}
	$.ajax({
		type:"PUT",
		url:url + parameter,
		success:callBack,
		data:svgString,
		error:function() {alert('截取图像失败！');}
	});
}

//设置一些私有方法为实例方法，方便被外部调用
$.extend(M.prototype, {
        svgWrapper: function() {
                return svgWrapper;
        },
        svgRoot: function() {
        	return svgRoot;
        },
        svgContainer: function() {
        	return svgContainer;
        },
        mapLevel: function() {
        	return map;
        },
        maskLevel: function() {
        	return  mask;
        },
        zoomInForAdobeSVG: zoomInForAdobeSVG,//用于adobesvg的鼠标点击放大函数
        maxMap: maxMap,//最大化地图（不建议使用）
        setWH: setWH,//设置（高宽）
        moveMap: moveMap,//移动地图
        zoomIn: zoomIn,//放大
        zoomOut: zoomOut,//缩小
        resetMap: resetMap,//重置地图
        stopAnimation: stopAnimation,//停止动画
        removeThing: removeThing,//移除
        addThing: addThing,//添加
        addThingToParent: addThingToParent,//添加到父节点
        rasterize:rasterize,//光栅化
        maxHeight:function() {
                return maxHeight;
        },
        maxWidth:function() {
                return maxWidth;
        },
        viewBox:function() {
                return parseViewBox(map.getAttribute('viewBox'));
        }
});

return M;
})(jQuery);