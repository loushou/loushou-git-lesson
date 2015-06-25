var QS = QS || {};
( function( $, QS, S, qt ) {
	var O = $.extend( true, { data:{}, strings:{} }, _qsot_seating_draw );
	console.log( 'settings', O );

	// prevent dragging in firefox ono ur canvas, because it makes it super difficult to draw on top an image
	$( document ).on( "dragstart", function( e ) {
		if ( $( e.target ).closest( '.qsot-seating-chart-ui' ).length )
			return false;
	} );

	function __( name ) {
		var args = [].slice.call( arguments, 1 ), str = qt.is( O.strings[ name ] ) ? O.strings[ name ] : name, i;
		for ( i = 0; i < args.length; i++ ) str = str.replace( '%s', args[ i ] );
		return str;
	}

	var features = {},
		hasClass; 

	$.find.support.getElementsByClassName = $.support.getElementsByClassName = ( function() {
		var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"), res = qt.is( svg.classList );
		delete svg;
		return res;
	} )();
	( function() {
		features.clsList = $.support.getElementsByClassName;
	} )();

	// fix jQuery so that it properly checks classes, where ever they may exist. without this, SVG objects (like circle) does not properly return true for hasClass() when the class is assigned
	( function( $ ) {
		hasClass = function( selector ) {
			if (false && features.clsList && qt.is( this[0].classList ) ) {
				return this[0].classList && this[0].classList.contains( selector );
			} else {
				return $.trim( qt.is( this[0].className ) ? ( qt.is( this[0].className.baseVal ) ? this[0].className.baseVal : this[0].className ) : this.attr( 'class' ) ).split( /[\s\uFEFF\xA0]+/g ).indexOf( selector ) > -1;
			}
		};
	} )( $ );

	$.extend( $.fn, { hasClass: hasClass } );

	qt.isB = function(v) { return typeof v == 'boolean'; };
	qt.isS = function(v) { return typeof v == 'string'; };
	qt.isN = function(v) { return typeof v == 'number'; };
	qt.isC = function(v, c) { return qt.isO( v ) && v.constructor == c ; };
	qt.dist = function(x1, y1, x2, y2) { var dx = x1 - x2, dy = y1 - y2; return Math.sqrt( ( dx * dx ) + ( dy * dy ) ); };
	qt.ucw = function(v) { return v.toLowerCase().replace( /^[\u00C0-\u1FFF\u2C00-\uD7FF\w]|\b[\u00C0-\u1FFF\u2C00-\uD7FF\w]/g, function( l ) { return l.toUpperCase(); } ); };
	qt.esc = function(v) {
			var div, res;
			( div = document.createElement( 'div' ) ).appendChild( document.createTextNode( v ) );
			res = div.innerHTML;
			delete div;
			return res;
		};
	qt.lineDist = function( pt, lp1, lp2 ) {
			//var hyp = qt.dist( pt.x, pt.y, lp1.x, lp1.y ), ang = S.angle( pt.x, pt.y, lp1.x, lp1.y ) - S.angle( lp1.x, lp1.y, lp2.x, lp2.y ), d =
			return Math.sin( S.rad( ( 360 + S.angle( pt.x, pt.y, lp1.x, lp1.y ) - S.angle( lp1.x, lp1.y, lp2.x, lp2.y ) ) % 360 ) ) * qt.dist( pt.x, pt.y, lp1.x, lp1.y );
			//return d;
		};

	QS.Bench = function() {
		this.start_time = {};
		this.totals = {};
		this.start = function( label, reset ) {
			var label = label || 'timer-' + ( Math.random() * 100000 );
			if ( reset || ! qt.is( this.totals[ label ] ) ) this.totals[ label ] = 0;
			this.start_time[ label ] = ( new Date ).getTime();
			return label;
		};
		this.split = function( label ) {
			if ( ! qt.is( this.start_time[ label ] ) ) this.start( label, true );
			var t = ( new Date ).getTime() - this.start_time[ label ];
			this.totals[ label ] += t;
			return t;
		};
		this.end = function( label, dont_print ) {
			if ( ! qt.is( this.start_time[ label ] ) ) return;
			var t = this.split( label );
			if ( ! dont_print ) this.report( label );
			this.totals[ label ] = 0;
			return t;
		};
		this.report = function( label, extra ) {
			if ( ! qt.is( this.start_time[ label ] ) ) return;
			console.log( label, this.totals[ label ], extra || '' );
		};
	};
	QS.bench = new QS.Bench();

	QS.ext = function( child, par ) {
		child.prototype = new par();
		child.prototype.constructor = child;
		child.prototype.parent = par;
	}

	function getIntersectionList_aabb_polyfill( rect, refEle, depth ) {
		if ( ! qt.isC( rect, SVGRect ) && ( ! qt.is( rect.x ) || ! qt.is( rect.y ) || ! qt.is( rect.width ) || ! qt.is( rect.height ) ) )
			throw new TypeError( __( 'Bounding box must be a rectangle.' ) );

		if ( ! qt.is( rect.min ) ) rect.min = { x:Math.min( rect.x, rect.x + rect.width ), y:Math.min( rect.y, rect.y + rect.height ) };
		if ( ! qt.is( rect.max ) ) rect.max = { x:Math.max( rect.x, rect.x + rect.width ), y:Math.max( rect.y, rect.y + rect.height ) };

		var ele = refEle || this, depth = depth || 0, matches = [], i = 0, ii = ele.children.length || 0, bbox = false, cbbox = false, abbox = false, intersect = false, child;

		for ( ; i < ii; i++ ) {
			child = ele.children[ i ];

			try {
				abbox = child.getBBox();
				cbbox = child.getBoundingClientRect();
				bbox = {
					width: abbox.width,
					height: abbox.height,
					x: cbbox.x + ( cbbox.width - abbox.width ),
					y: cbbox.y + ( cbbox.height - abbox.height )
				};
			} catch( err ) {
				bbox = false;
			}

			if ( qt.isO( bbox ) ) {
				intersect = ( function( f, s ) {
					if ( f.max.x < s.min.x || f.max.y < s.min.y || s.max.x < f.min.x || s.max.y < f.min.y ) return false; // disjointed
					var sxn = false, sxx = false, syn = false, syx = false;
					if ( ( sxn = f.min.x < s.min.x && s.min.x < f.max.x ) && ( syn = f.min.y < s.min.y && s.min.y < f.max.y ) ) return true; // s upper left inside f
					if ( ( sxx = f.min.x < s.max.x && s.max.x < f.max.x ) && syn ) return true; // s upper right inside f
					if ( sxx && ( syx = f.min.y < s.max.y && s.max.y < f.max.y ) ) return true; // s bottom left inside f
					if ( sxx && syx ) return true; // s bottom right inside f
					var fxn = false, fxx = false, fyn = false, fyx = false;
					if ( ( fxn = s.min.x < f.min.x && f.min.x < s.max.x ) && ( fyn = s.min.y < f.min.y && f.min.y < s.max.y ) ) return true; // f upper left inside s
					if ( ( fxx = s.min.x < f.max.x && f.max.x < s.max.x ) && fyn ) return true; // f upper right inside s
					if ( fxx && ( fyx = s.min.y < f.max.y && f.max.y < s.max.y ) ) return true; // f bottom left inside s
					if ( fxx && fyx ) return true; // f bottom right inside s
					if ( fyn && fyx && sxn && sxx ) return true;
					if ( syn && syx && fxn && fxx ) return true;
					return false;
				} )( rect, { min:{ x:bbox.x, y:bbox.y }, max:{ x:bbox.x + bbox.width, y:bbox.y + bbox.height } } );

				if ( intersect ) matches[ matches.length ] = child
			}

			if ( child.childElementCount ) {
				var child_matches = child.getIntersectionList( rect, child, depth + 1 );
				matches.concat( child_matches );
			}
		}

		return matches;
	}

	var event_names = [ 'click', 'mouseout', 'mouseover', 'dblclick', 'mousemove', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel' ],
			shape_funcs = [ 'rect', 'circle', 'image', 'ellipse', 'path', 'group', 'g', 'svg', 'mask', 'ptrn', 'use', 'text', 'line', 'polyline', 'polygon', 'gradient', 'gradientLinear', 'gradientRadial' ],
			selectable = [ 'rect', 'circle', 'image', 'ellipse', 'path', 'text', 'line', 'polyline', 'polygon' ],
			has = 'hasOwnProperty',
			cssAttr = {
				"alignment-baseline": 0, "baseline-shift": 0, "clip": 0, "clip-path": 0, "clip-rule": 0, "color": 0, "color-interpolation": 0, "color-interpolation-filters": 0, "color-profile": 0, "color-rendering": 0,
				"cursor": 0, "direction": 0, "display": 0, "dominant-baseline": 0, "enable-background": 0, "fill": 0, "fill-opacity": 0, "fill-rule": 0, "filter": 0, "flood-color": 0, "flood-opacity": 0, "font": 0, "font-family": 0,
				"font-size": 0, "font-size-adjust": 0, "font-stretch": 0, "font-style": 0, "font-variant": 0, "font-weight": 0, "glyph-orientation-horizontal": 0, "glyph-orientation-vertical": 0, "image-rendering": 0, "kerning": 0,
				"letter-spacing": 0, "lighting-color": 0, "marker": 0, "marker-end": 0, "marker-mid": 0, "marker-start": 0, "mask": 0, "opacity": 0, "overflow": 0, "pointer-events": 0, "shape-rendering": 0, "stop-color": 0,
				"stop-opacity": 0, "stroke": 0, "stroke-dasharray": 0, "stroke-dashoffset": 0, "stroke-linecap": 0, "stroke-linejoin": 0, "stroke-miterlimit": 0, "stroke-opacity": 0, "stroke-width": 0, "text-anchor": 0,
				"text-decoration": 0, "text-rendering": 0, "unicode-bidi": 0, "visibility": 0, "word-spacing": 0, "writing-mode": 0
			},
			click_thresh = 2,
			supportsTouch = "createTouch" in document,
			touchMap = { mousedown:"touchstart", mousemove:"touchmove", mouseup:"touchend" },
			xlink = "http://www.w3.org/1999/xlink",
			xmlns = "http://www.w3.org/2000/svg",
			shape_id = 0,
			// Z is becasue 'id' attributes cannot begin with numbers legally. this ensures that they start with a letter
			shape_id_prefix = 'Z' + ( new Date ).getTime().toString( 16 ) + '-',
			cp_dist = 10,
			svgrect_relative = false;

	if ( ! qt.isF( SVGSVGElement.prototype.getIntersectionList ) ) {
		svgrect_relative = true;
		SVGSVGElement.prototype.getIntersectionList = getIntersectionList_aabb_polyfill;
	}

	// create a new shape id for a new shape element, if it has not already been assigned one.
	// this is used extensively with the undoer, so that we can keep track of which objects have actions done to them, without keeping a reference to the object itself,
	// because doing that would require always updating the tracked objects, which is painful and heavy
	function fix_id_field( val ) {
		return val ? val : shape_id_prefix + ( ++shape_id );
	}

	// same as above, only it wraps the id in the undoer funciton object
	function fix_id( info ) {
		info.data.obj_id = fix_id_field( info.data.obj_id );
		return info;
	}

	// older save ids were not guaranteed to have a letter at the beginning. this causes browser queries to fail. repair them
	function fix_save_id( save_id ) {
		if ( save_id && ! isNaN( parseInt( save_id.charAt(0), 10 ) ) )
			save_id = 'Z' + save_id;
		return save_id || fix_id_field();
	}

	// event handler wrapper that will allow the context of the function to be set, while allowing the function to maintain it's independent scope
	function _forward( func, context ) {
		return function() {
			var args = [].slice.call( arguments, 0 ),
					cntxt = context || this;
			args.unshift( this );
			func.apply( cntxt, args );
		};
	}


	// do something on key(up|down), for the entire window
	function _on_key( dir, keys, func, ns ) {
		var keys = keys.split( / +/ ), kns = ns || 'keys-' + keys.join( '' ), map = {}, i;

		for ( i = 0; i < keys.length; i++ ) ( function( key ) {
			var parts, n, code;
			if ( key.indexOf( '+' ) >= 0 ) parts = key.split( /\+/ );
			else parts = [ key.replace( /^([^0-9]+)?[0-9]*$/, '$1' ), key.replace( /^([^0-9]+)?([0-9]+)$/, '$2' ) ];
			n = parts.pop();

			if ( ! qt.isA( map[ n ] ) ) map[ n ] = [];

			if ( parts.length && '~' == parts[0] ) {
				map[ n ] = [ '000', '001', '010' ,'100', '011', '110', '101', '111' ];
			} else {
				map[ n ].push(
					( ( parts.indexOf( 'shift' ) > -1 || parts.indexOf( 's' ) > -1 ) ? '1' : '0' )
						+ ( ( parts.indexOf( 'ctrl' ) > -1 || parts.indexOf( 'c' ) > -1 ) ? '1' : '0' )
						+ ( ( parts.indexOf( 'alt' ) > -1 || parts.indexOf( 'a' ) > -1 ) ? '1' : '0' )
				);
			}
		} )( keys[ i ] );

		$( window ).off( 'key' + dir + '.' + kns ).on( 'key' + dir + '.' + kns, function( ev ) {
			if ( $( 'input:focus, select:focus, textarea:focus' ).length ) return;
			var code = ( ev.shiftKey ? '1' : '0' ) + ( ev.ctrlKey || ev.metaKey ? '1' : '0' ) + ( ev.altKey ? '1' : '0' );
			if ( qt.is( map[ ev.which + '' ] ) && map[ ev.which + '' ].indexOf( code ) > -1 ) func( ev );
		} );
	}

	// remove the _on_key funcitonality from above
	function _off_key( dir, keys, ns ) {
		var keys = keys.split( / +/ ), kns = ns || 'keys-' + keys.join( '' ), i;
		$( window ).off( 'key' + dir + '.' + kns );
	}

	// do something on keyup
	function _on_keyup( keys, func, ns ) { return _on_key( 'up', keys, func, ns ); }
	function _off_keyup( keys, ns ) { return _off_key( 'up', keys, ns ); }
	// do something on keydown
	function _on_keydown( keys, func, ns ) { return _on_key( 'down', keys, func, ns ); }
	function _off_keydown( keys, ns ) { return _off_key( 'down', keys, ns ); }

	// enable the global ability to disable the current action by pressing the esc key when the action is taking place
	function _enable_cancel( on_cancel ) {
		_on_keyup( '27 s27 c27 a27', on_cancel );
	}

	// disable the global esc cancel functionality above
	function _disable_cancel() {
		_off_keyup( '27 s27 c27 a27' );
	}

	// wrapper funciton for creating a new paper (may have an actual use later)
	function _new_paper() {
		var paper = S.apply( undefined, [].slice.call( arguments, 0 ) );
		QS.cbs.trigger( 'new-paper', [ paper ] );
		return paper;
	}

	// keep a lookup table of all active elements, and give access to it, for faster lookups
	// also, various other new Element utility functions
	S.plugin( function( S, E, P, G, F ) {
		var i,
				ii,
				hub = {};

		// Hub garbage collector every 5s -- copied from snap internal
		setInterval( function () {
			for ( var key in hub ) if ( hub[ has ]( key ) ) {
				var el = hub[ key ],
						node = el.node;
				if ( el.type != "svg" && ! node.ownerSVGElement || el.type == "svg" && ( ! node.parentNode || "ownerSVGElement" in node.parentNode && ! node.ownerSVGElement ) ) {
					delete hub[ key ];
				}
			}
		}, 5e3 );

		for ( i = 0, ii = shape_funcs.length; i < ii; i++ ) {
			( function( func_name ) {
				var func = P.prototype[ func_name ];
				P.prototype[ func_name ] = function() {
					var r = func.apply( this, [].slice.call( arguments, 0 ) );
					return r ? hub[ r.node.snap ] = r : r;
				};
			} )( shape_funcs[ i ] );
		}

		var wrap = S._.wrap;
		S._.wrap = function() {
			var r = wrap.apply( wrap, [].slice.call( arguments ) );
			return r ? hub[ r.node.snap ] = r : r;
		};

		S.str4ele = function( str ) {
			if ( hub[has]( str ) ) return hub[ str ];
			return undefined;
		};

		S.node4ele = function( node ) {
			if ( ! qt.is( node.snap ) ) return S._.wrap( node );
			if ( hub[has]( node.snap ) ) return hub[ node.snap ];
			return S._.wrap( node );
		};

		// overtake the clone function, so that we can:
		// - assign the new element a uniq new id
		// - add the new element to our hub, for lookups
		var clone_func = E.prototype.clone;
		E.prototype.clone = function() {
			var new_one = clone_func.apply( this, [].slice.call( arguments ) );
			if ( qt.is( new_one ) && qt.is( new_one.node ) ) {
				if ( this.attr( 'id' ) )
					new_one.attr( { id:fix_id_field() } );
				hub[ new_one.node.snap ] = new_one;
			}
			return new_one;
		};

		// allow functions to be param values for el.attr()
		// copied form core snapsvg... but added function ability
		function is( v, t ) { return typeof v == t; }


		E.prototype.attr = function ( params, value ) {
			var el = this,
					node = el.node;
			if ( ! params) {
				return el;
			}
			if ( qt.isS( params ) ) {
				if ( arguments.length > 1 ) {
					var json = {};
					json[ params ] = value;
					params = json;
				} else {
					return eve( "snap.util.getattr." + params, el ).firstDefined();
				}
			}
			for ( var att in params ) {
				if ( params[ has ]( att ) ) {
					var val = params[ att ];
					if ( qt.isF( val ) ) val = val.call( this, att );
					eve( "snap.util.attr." + att, el, val );
				}
			}
			return el;
		};

		function getComputedStyle( dom ) {
			var style;
			var returns = {};
			// FireFox and Chrome way
			if ( window.getComputedStyle ) {
				style = window.getComputedStyle( dom, null );
				for ( var i = 0, l = style.length; i < l; i++ ) {
					var prop = style[ i ];
					var val = style.getPropertyValue( prop );
					returns[ prop ] = val;
				}
				return returns;
			}
			// IE and Opera way
			if ( dom.currentStyle ) {
				style = dom.currentStyle;
				for ( var prop in style ) {
					returns[ prop ] = style[ prop ];
				}
				return returns;
			}
			// Style from style attribute
			if ( style = dom.style ) {
				for ( var prop in style ) {
					if ( typeof style[ prop ] != 'function' ) {
						returns[ prop ] = style[ prop ];
					}
				}
				return returns;
			}
			return returns;
		};

		E.prototype.all_attrs = function() {
			var attrs = this.node.attributes,
					name,
					out = {};
			for (var i = 0; i < attrs.length; i++) {
				if (attrs[i].namespaceURI == xlink) {
					name = "xlink:";
				} else {
					name = "";
				}
				name += attrs[i].name;
				out[name] = attrs[i].value;
			}
			return $.extend( {}, out, { style:getComputedStyle( this.node ) } );
		};

		// polyfill stuff
		E.prototype.hide = function() { return this.attr( 'visibility', 'hidden' ); };
		E.prototype.show = function() { return this.attr( 'visibility', 'visible' ); };

		// allow drag mode switching (could be useful for 'modes' of editing)
		E.prototype.set_drag_mode = function( mode ) {
			this.data( 'dmode', mode );
			return this;
		};

		E.prototype.get_drag_mode = function() { return this.data( 'dmode' ); };

		// beter performance versions of the add and remove class functions. leverage broswer functions if available or use a faster backup function than comes with snap
		E.prototype.addClass = function( cls ) {
			if ( features.clsList && qt.is( this.node.classList ) ) {
				this.node.classList.add.apply( this.node.classList, ( qt.isA( cls ) ? cls : cls.split( /\s+/ ) ).filter( function( v ) { return !!v; } ) );
			} else {
				var cls = ( qt.isA( cls ) ? cls : cls.split( /\s+/ ) ).filter( function( v ) { return !!v; } ), node = this.node, cur = node.className.baseVal.split( /\s+/ ).filter( function( v ) { return !!v; } )
				node.className.baseVal = $.unique( cls.concat( cur ) ).join( ' ' );
			}
			return this;
		};
		E.prototype.removeClass = function( cls ) {
			if ( features.clsList && qt.is( this.node.classList ) ) {
				this.node.classList.remove.apply( this.node.classList, ( qt.isA( cls ) ? cls : cls.split( /\s+/ ) ).filter( function( v ) { return !!v; } ) );
			} else {
				var arr = ( qt.isA( cls ) ? cls : cls.split( /\s+/ ) ).filter( function( v ) { return !!v; } ), node = this.node, cur = node.className.baseVal.split( /\s+/ ).filter( function( v ) { return !!v; } ), fin = [], cls = {}, i;
				for ( i = 0; i < arr.length; i++ ) cls[ arr[ i ] ] = 1;
				for ( i = 0; i < cur.length; i++ ) if ( ! qt.is( cls[ cur[ i ] ] ) ) fin[ fin.length ] = cur[ i ];
				node.className.baseVal = fin.join( ' ' );
			}
			return this;
		};
	} );

	// move these func declarations to the outer scope
	var getScroll, preventDefault, preventTouch, stopPropagation, stopTouch, addEvent;

	// register our event related functions that require some internal information from SNAP
	S.plugin( function( S, E, P, G, F ) {
		// these functions are largely copied from core SNAP (this is why they break most naming convention)
		getScroll = function ( xy, el ) {
			var name = ( xy == "y" ) ? "scrollTop" : "scrollLeft",
					doc = ( el && el.node ) ? el.node.ownerDocument : G.doc;
			return doc[ ( name in doc.documentElement ) ? "documentElement" : "body" ][ name ];
		},
		preventDefault = function () { this.returnValue = false; },
		preventTouch = function () { return this.originalEvent.preventDefault(); },
		stopPropagation = function () { this.cancelBubble = true; },
		stopTouch = function () { return this.originalEvent.stopPropagation(); },
		addEvent = ( function () {
			if ( G.doc.addEventListener ) {
				return function ( obj, type, fn, element ) {
						var realName = supportsTouch && touchMap[ type ] ? touchMap[ type ] : type,
								f = function ( e ) {
									var scrollY = getScroll( "y", element ),
											scrollX = getScroll( "x", element );
									if ( supportsTouch && touchMap[ has ]( type ) ) {
										for ( var i = 0, ii = e.targetTouches && e.targetTouches.length; i < ii; i++ ) {
											if ( e.targetTouches[ i ].target == obj || obj.contains( e.targetTouches[ i ].target ) ) {
												var olde = e;
												e = e.targetTouches[ i ];
												e.originalEvent = olde;
												e.preventDefault = preventTouch;
												e.stopPropagation = stopTouch;
												break;
											}
										}
									}
									var x = e.clientX + scrollX,
											y = e.clientY + scrollY;
									return fn.call( element, e, x, y );
								};

						if ( type !== realName ) {
							obj.addEventListener( type, f, false );
						}

						obj.addEventListener( realName, f, false );

						return function () {
							if ( type !== realName ) {
								obj.removeEventListener( type, f, false );
							}

							obj.removeEventListener( realName, f, false );
							return true;
						};
				};
			} else if ( G.doc.attachEvent ) {
				return function ( obj, type, fn, element ) {
					var f = function ( e ) {
						e = e || element.node.ownerDocument.window.event;
						var scrollY = getScroll( "y", element ),
								scrollX = getScroll( "x", element ),
								x = e.clientX + scrollX,
								y = e.clientY + scrollY;
						e.preventDefault = e.preventDefault || preventDefault;
						e.stopPropagation = e.stopPropagation || stopPropagation;
						return fn.call( element, e, x, y );
					};
					obj.attachEvent( "on" + type, f );
					var detacher = function () {
						obj.detachEvent( "on" + type, f );
						return true;
					};
					return detacher;
				};
			}
		} )();
	} );

	S.plugin( function( S, E, P, G, F ) {
		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			var rproto = {}, inc = 0;

			function RM() {
				this.ui = ui;
				this.e = { cache:{} };
				this.menus = {};
				_setup_elements( this );
				QS.cbs.trigger( 'right-menu-register', [ this ] );
			}

			rproto.show = function( menu, get_items_func, winx, winy ) {
				if ( ! qt.isS( menu ) || ! qt.is( this.menus[ menu ] ) ) return;
				var me = this;
				me.e.main.empty();

				for ( i = 0; i < me.menus[ menu ].length; i++ ) ( function( mitem ) {
					var item;
					if ( qt.is( me.e.cache[ menu + mitem.label ] ) ) item = me.e.cache[ menu + mitem.label ].clone( true );
					else {
						item = me.e.cache[ menu + mitem.label ] = me.e.item_tmpl.clone( true );
						item.text( mitem.label );
					}
					item.on( 'click.right-menu', function() {
						mitem.run( get_items_func );
						me.hide();
					} ).appendTo( me.e.main );
				} )( me.menus[ menu ][ i ] );
				
				me.e.main.css( { left:winx, top:winy } ).show();
				_enable_cancel( function() { me.hide(); } );
			}

			rproto.hide = function() {
				var me = this;
				me.e.main.hide().empty().position( { my:'left top', at:'left+0 top+0', of:me.e.main.parent() } );
				_disable_cancel();
			}

			rproto.register = function( menu, items ) {
				if ( ! qt.isS( menu ) ) return;
				var i;
				for ( i = 0; i < items.length; i++ ) items[ i ] = $.extend( { label:'item-' + ( inc++ ), run:function(){} }, items[ i ] );
				this.menus[ menu ] = items;
			}

			function _setup_elements( t ) {
				t.e.main = $( '<div class="qsot-right-menu"></div>' ).css( { display:'none' } ).appendTo( 'body' );
				t.e.item_tmpl = $( '<div class="qsot-menu-item"></div>' );
			}
			
			RM.prototype = rproto;

			ui.right_menu = new RM();
		} );
	} );

	S.plugin( function( S, E, P, G, F ) {
		var zproto = {};
		var fl = Math.floor.
				cl = Math.ceil,
				mn = Math.min,
				mx = Math.max;

		function zoomer( ele, opts ) {
			this.o = {
				ui: {},
				def_spd: 350,
				def_step: 0.1,
				def_method: 'linear',
				orig_height: 0,
				orig_width: 0,
				cur: 1,
				max: 25,
				min: 0.5,
				panx: 0,
				pany: 0,
				method: function() {}
			};
			this.set_options( opts );
			this.set_ele( ele );
			this.set_mode( this.o.def_method );

			var me = this;
			$( window ).off( 'resize.calc' ).on( 'resize.calc', function() {
				var cur = ( Math.random() * 999999999 ) + '-' + ( Math.random() * 999999 );
				last = cur;
				setTimeout( function() { if ( last == cur ) me.calc_view_port(); }, 50 );
			} );

			this.set_zoom( this.o.cur, -1 );
		}

		zproto.adjust = function( x, y ) { return this.for_zoom( { x:fl( x ), y:fl( y ) } ); }
		zproto.for_zoom = function( xy ) { return { x:xy.x / this.o.cur, y:xy.y / this.o.cur }; }
		zproto.for_pan = function( xy ) { return { x:xy.x - this.o.panx, y:xy.y - this.o.pany }; }

		zproto.real_pos_to_virtual_pos = function( xy ) {
			var from_center = { x:-$( this.o.ui.e.canvas ).width() / 2, y:-$( this.o.ui.e.canvas ).height() / 2 }, offset = { x:(from_center.x / this.o.cur) - from_center.x, y:(from_center.y / this.o.cur) - from_center.y };
			return { x:offset.x + (xy.x / this.o.cur) - this.o.panx, y:offset.y + (xy.y / this.o.cur) - this.o.pany };
		}

		zproto.virtual_pos_to_real_pos = function( xy ) {
			var from_center = { x:-$( this.o.ui.e.canvas ).width() / 2, y:-$( this.o.ui.e.canvas ).height() / 2 }, offset = { x:(from_center.x / this.o.cur) - from_center.x, y:(from_center.y / this.o.cur) - from_center.y },
					res = { x:( xy.x - offset.x ) * this.o.cur, y:( xy.y - offset.y ) * this.o.cur };
			return res
			//return { x:offset.x + (xy.x / this.o.cur) - this.o.panx, y:offset.y + (xy.y / this.o.cur) - this.o.pany };
		}

		zproto.to_scale = function( val ) {
			return val / this.o.cur;
		}

		zproto.in = function( to, spd, from_x, from_y ) {
			var me = this,
					to = me.o.method.call( me, to || me.o.def_step, 1, function( v ) { return Math.min( v, me.o.max ); } )
			this.set_zoom( to, spd, from_x, from_y );
		}

		zproto.out = function( to, spd, from_x, from_y ) {
			var me = this,
					to = me.o.method.call( me, to || me.o.def_step, -1, function( v ) { return Math.max( v, me.o.min ); } )
			this.set_zoom( to, spd, from_x, from_y );
		}

		zproto.pan = function( dx, dy ) {
			this.o.panx += dx;
			this.o.pany += dy;
			this.set_zoom( this.o.cur, -1 );
		}

		zproto.panTo = function( x, y ) {
			this.o.panx = x;
			this.o.pany = y;
			this.set_zoom( this.o.cur, -1 );
		}

		zproto.fix_borders = function() {
			var lvl = this.o.cur; /// ? 1 / this.o.cur : 1;
			this.o.ele[ lvl > 2 ? 'addClass' : 'removeClass' ]( 'lvl-2' );
			this.o.ele[ lvl > 4 ? 'addClass' : 'removeClass' ]( 'lvl-4' );
			this.o.ele[ lvl > 8 ? 'addClass' : 'removeClass' ]( 'lvl-8' );
			this.o.ele[ lvl > 16 ? 'addClass' : 'removeClass' ]( 'lvl-16' );
			this.o.ele[ lvl > 32 ? 'addClass' : 'removeClass' ]( 'lvl-32' );
		}

		zproto.get_zoom = function() { return this.o.cur; }

		zproto.set_default_zoom = function( val ) {
			var val = val || this.o.cur;
			this.o.ui.setting( 'zoom', val );
		};

		zproto.set_ele = function( ele ) {
			this.disallow_pan();
			this.o.ele = ele; //.attr( 'preserveAspectRatio', 'xMidYMid slice' );
			this.calc_view_port();
			this.allow_pan();
		}

		zproto.calc_view_port = function() {
			var svg = $( this.o.ele.node ).closest( 'svg' );
			//svg = svg.length ? svg : $( this.o.ele.node );
			this.o.orig_height = qt.toFloat( svg.height() );
			this.o.orig_width = qt.toFloat( svg.width() );
			this.set_zoom( this.o.cur, -1 );
		}

		zproto.current_center = function() {
			return { x:this.o.orig_width / 2, y:this.o.orig_height / 2 };
		}

		zproto.set_zoom = function( value, spd, from_x, from_y ) {
			if ( 'svg' == this.o.ele.type ) return;

			var spd = qt.toInt( spd ),
					from_x = qt.is( from_x ) ? from_x : ( this.o.orig_width ) / 2, //undefined, //( ( this.o.orig_width ) / 2 ),
					from_y = qt.is( from_y ) ? from_y : ( this.o.orig_height ) / 2; //undefined; //( ( this.o.orig_height ) / 2 );
			spd = spd ? spd : this.o.def_spd;

			if ( spd < 0 ) this.change( value, from_x, from_y );
			else this.animate( value, spd, from_x, from_y );
		}

		zproto.change = function( value, from_x, from_y ) {
			var m = new S.Matrix();
			this.o.cur = value;
			m.translate( this.o.panx * value, this.o.pany * value ).scale( value, value, from_x, from_y );
			this.o.ele.transform( m );
			this.fix_borders();
			QS.cbs.trigger( 'zoom-pan-updated', [ this ] );
		}

		zproto.animate = function( value, spd, from_x, from_y ) {
			var me = this,
					m = new S.Matrix();
			
			this.o.cur = value;
			m.translate( this.o.panx * value, this.o.pany * value ).scale( value, value, from_x, from_y );
			this.o.ele.stop().animate( { transform:m }, spd, mina.easein, function() { me.fix_borders(); QS.cbs.trigger( 'zoom-pan-updated', [ me ] ); } );
		}

		zproto.modes = {
			linear: function( amt, dir, sane ) { var dir = dir || 1, sane = sane || function( a ) { return a; }; return sane( this.o.cur + ( amt * dir ) ); },
			exponential: function( amt, dir, sane ) { var dir = dir || 1, sane = sane || function( a ) { return a; }, amt = amt || 1; return sane( dir > 0 ? this.o.cur * amt : this.o.cur / amt ); }
		};

		zproto.set_mode = function( mode ) {
			this.o.method = mode && qt.isF( this.modes[ mode ] ) ? this.modes[ mode ] : this.modes.linear;
		}

		zproto.set_options = function( opts ) {
			this.o = $.extend( this.o, opts );
		}

		function pan_mousedown( me, e, x, y ) {
			me.o.ele.addClass( 'panning' ).data( 'started', { x:x, y:y, px:me.o.panx, py:me.o.pany } );
		}
		function pan_mousemove( me, e, x, y ) {
			if ( ! me.o.ele.hasClass( 'panning' ) ) return;
			var from = me.o.ele.data( 'started' ),
					d = { x:x - from.x, y:y - from.y };
			me.panTo( ( d.x / me.o.cur ) + from.px, ( d.y / me.o.cur ) + from.py );
		}
		function pan_mouseup( me, e, x, y ) {
			me.o.ele.removeClass( 'panning' ).removeData( 'started' );
		}
		function pan_scroll( me, e ) {
		}

		function _svg( ele ) {
			var svg = $( ele.node ).parents( 'svg:last' );
			return ( svg.length ) ? svg.get( 0 ) : ele.node;
		}

		zproto.allow_pan = function() {
			$( window ).off( 'scroll.cap' ).on( 'scroll.cap', function() { var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_scroll.apply( this, args ); } );
			var me = this, svg = _svg( me.o.ele ), down = false;

			me.evs = [
				addEvent( svg, 'mousedown', function( e ) { down = true; } ),
				addEvent( window, 'mouseup', function( e ) { if ( down ) { down = false; var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_mouseup.apply( this, args ); } } ),
				addEvent( window, 'mousedown', function( e ) { if ( down ) { var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_mousedown.apply( this, args ); } } ),
				addEvent( window, 'mousemove', function( e ) { if ( down ) { var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_mousemove.apply( this, args ); } } )
			];
		}

		zproto.disallow_pan = function() {
			if ( qt.isA( this.evs ) ) {
				for ( var i = 0, ii = this.evs.length; i < ii; i++ ) this.evs[ i ]();
				delete this.evs;
			}
		}

		zoomer.prototype = zproto;

		QS.cbs.add( 'canvas-settings-defaults', function( sets ) {
			return $.extend( {}, sets, { zoom:1 } );
		} );

		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			paper.zoom = new zoomer( paper, { def_step:2, max:25, min:0.125, cur:ui.setting( 'zoom' ), def_method:'exponential', ui:ui } );
		} );

		QS.cbs.add( 'create-btns', function( t ) {
			t.utils.add_btn( {
				ele: t.utils.hud.path( 'M6,0L9,0L9,6L15,6L15,9L9,9L9,15L6,15L6,9L0,9L0,6L6,6z' ),
				only_click: true,
				name: 'zoom-in',
				title: 'Zoom-In',
				click: function() { t.canvas.zoom.in(); t.toolbar.activate( 'pointer' ); }
			} );

			t.utils.add_btn( {
				ele: t.utils.hud.path( 'M0,0L15,0L15,4L0,4z' ),
				only_click: true,
				name: 'zoom-out',
				title: 'Zoom-Out',
				click: function() { t.canvas.zoom.out(); t.toolbar.activate( 'pointer' ); }
			} );

			/*
			t.utils.add_btn( {
				ele: t.utils.hud.path( 'M0,7L4,7L4,9L0,9zM0,11L4,11L4,13L0,13zM7,3L9,3L9,16L7,16z' ),
				only_click: true,
				name: 'set-default-zoom',
				title: 'Set Default Zoom',
				click: function() { t.canvas.zoom.set_default_zoom(); }
			} );
			*/
		} );
	} );

	S.plugin( function( S, E, P, G, F ) {
		var sproto = {};

		function scaler( ui, o ) {
			this.o = $.extend( {}, this.defs, this.o, o );
			this.e = {};
			this.ui = ui;
			this.init();
		}

		sproto.defs = {
			ratio:1
		};

		sproto.is_hidden = false;

		sproto.init = function() {
			this.setup_elements();
			this.setup_hooks();
		};

		sproto.hide = function() { this.e.sclr.attr( 'visibility', 'hidden' ); return this; }
		sproto.show = function() { this.e.sclr.attr( 'visibility', 'visible' ); return this; }
		sproto.move_start = function() { this.adjust_bounds(); this.e.sclr.data( 'orig-matrix', ( this.e.sclr.matrix || new S.Matrix ).clone() ); return this; };
		sproto.move = function( x, y, force ) {
			var force = force || false, m = force ? new S.Matrix : ( this.e.sclr.data( 'orig-matrix' ) || new S.Matrix );
			this.e.sclr.transform( ( new S.Matrix ).translate( x, y ).add( m ) );
			return this;
		}
		sproto.move_end = function() { this.e.sclr.data( 'orig-matrix', ( this.e.sclr.matrix || new S.Matrix ).clone() ); this.adjust_bounds(); return this; };
		sproto.move_reset = function() { this.e.sclr.transform( this.e.sclr.data( 'orig-matrix' ) || new S.Matrix ); this.adjust_bounds(); return this; };

		sproto.adjust_bounds = function( cntr ) {
			if ( this.is_hidden ) return this;
			if ( ! this.ui.canvas.Selection.length ) {
				this.hide();
			} else {
				var bnds = this.ui.canvas.Selection.getBBox(), m = this.ui.shp.transform().localMatrix.clone(), sm = m.split();
				cntr = /*cntr ||*/ { x:bnds.width * sm.scalex / 2, y:bnds.height * sm.scaley / 2 };
				this.e.cntr.transform( ( new S.Matrix ).translate( cntr.x, cntr.y ) );
				this.e.nw.transform( ( new S.Matrix ).translate( 0, 0 ) );
				this.e.ne.transform( ( new S.Matrix ).translate( bnds.width * sm.scalex, 0 ) );
				this.e.sw.transform( ( new S.Matrix ).translate( 0, bnds.height * sm.scaley ) );
				this.e.se.transform( ( new S.Matrix ).translate( bnds.width * sm.scalex, bnds.height * sm.scaley ) );
				this.move( m.x( bnds.x, bnds.y ), m.y( bnds.x, bnds.y ), true ).show();
			}
			return this;
		};

		sproto.setup_hooks = function() {
			var me = this;
			$( window ).on( 'keydown', function( ev ) { if ( ev.altKey ) { me.hide(); me.is_hidden = true; } } )
					.on( 'keyup', function( ev ) { if ( me.is_hidden ) { me.is_hidden = false; me.adjust_bounds(); } } );
			QS.cbs.add( 'selection-changed', function() {
				me.adjust_bounds().move_end();
			} );
			QS.cbs.add( 'selection-move-start', function( sel, x, y ) { me.move_start( x, y ); } );
			QS.cbs.add( 'selection-moved', function( sel, x, y ) { me.move( x, y ); } );
			QS.cbs.add( 'selection-move-end', function( sel ) { me.move_end(); } );
			QS.cbs.add( 'selection-move-cancel', function( sel ) { me.move_reset(); } );
			QS.cbs.add( 'zoom-pan-updated', function( zmr ) { me.adjust_bounds().move_end() } );
		};

		sproto.setup_elements = function() {
			var me = this;
			this.e.sclr = this.ui.canvas.g().attr( { id:'sclr' } ).appendTo( this.ui.tool );
			this.e.cntr = this.ui.canvas.g().attr( { id:'sclr-cntr' } ).appendTo( this.e.sclr );
			this.ui.canvas.line( 0, -5, 0, 5 ).attr( { stroke:'#bbb', fill:'transparent' } ).appendTo( this.e.cntr );
			this.ui.canvas.line( -5, 0, 5, 0 ).attr( { stroke:'#bbb', fill:'transparent' } ).appendTo( this.e.cntr );
			this.ui.canvas.circle( 0, 0, 2.5 ).attr( { stroke:'#444', fill:'transparent' } ).appendTo( this.e.cntr );

			var r = 2.5, w = 4 * r, h = 4 * r, offx = -r, offy = -r, mvrs = S.set(), rotrs = S.set(),
					grps = {
						// martices for corners of scler box
						nw: [ 1, 1, 1, 1, 0, 1, 1, 0 ],
						ne: [ -1, 1, -1, 1, 0, 1, -1, 0 ],
						sw: [ 1, -1, 1, -1, 0, -1, 1, 0 ],
						se: [ -1, -1, -1, -1, 0, -1, -1, 0 ]
					}, g;

			for ( g in grps ) {
				var gx = offx * grps[ g ][0],
						gy = offy * grps[ g ][1],
						gw = w * grps[ g ][2],
						gh = h * grps[ g ][3],
						glw = w * grps[ g ][4],
						glh = h * grps[ g ][5],
						glw2 = w * grps[ g ][6],
						glh2 = h * grps[ g ][7];
				// group container
				this.e[ g ] = this.ui.canvas.g().attr( { id:'sclr-' + g } ).appendTo( this.e.sclr ).data( 'matrix', grps[ g ] );
				// group move ui
				this.e[ g + 'm' ] = this.ui.canvas.g().attr( { id:'sclr-' + g + '-mv' } ).appendTo( this.e[ g ] );
				mvrs.push( this.e[ g + 'm' ] );
				this.ui.canvas.polyline( [
					gx + glw, gy + glh, // vertical line start
					gx, gy, // corner behind circle
					gx + glw2, gy + glh2 // horizontal line end
				] ).attr( { stroke:'#bbb', fill:'transparent' } ).appendTo( this.e[ g + 'm' ] );
				this.ui.canvas.circle( 0, 0, r ).attr( { stroke:'#444', fill:'transparent' } ).appendTo( this.e[ g + 'm' ] );
				// north gwest rotate
				this.e[ g + 'r' ] = this.ui.canvas.g().attr( { id:'sclr-' + g + '-r' } ).appendTo( this.e[ g ] );
				rotrs.push( this.e[ g + 'r' ] );
				this.ui.canvas.polygon( [
					gx, gy, // corner behind circle
					gx + gw, gy, // middlemost horizontal line end
					gx + gw, gy - gh, // innermost vertical line end
					gx - gw, gy - gh, // outermost horizontal line end
					gx - gw, gy + gh, // outermost vertical line end
					gx, gy + gh // innermost horizontal line end
					// auto connection by polygon tool for middlemost vertical line
				]).attr( { fill:'#000', opacity:0.02, stroke:'#bbb' } ).appendTo( this.e[ g + 'r' ] );
			}

			me.e.cntr.drag( function( dx, dy, x, y, ev ) {
				ev.stopPropagation();
				var m = this.data( 'orig-matrix' ).clone().translate( dx, dy );
				this.transform( m );
			}, function( x, y, ev ) {
				ev.stopPropagation();
				this.data( 'orig-matrix', ( this.matrix || new S.Matrix ).clone() );
			}, function( ev ) {
				ev.stopPropagation();
				this.removeData( 'orig-matrix' );
			} );

			var dxy = {}, last_dxy = { x:0, y:0 };
			// extrapolate the move function so that it can be called separately by the keyup code
			function mvrs_move( ev ) {
				if ( me.e.sclr.hasClass( 'scaling' ) ) {
					var s = ( me.ui.shp.matrix || new S.Matrix ).split(),
							r = ev.shiftKey ? dxy.a : 1,
							dx = last_dxy.x, dy = last_dxy.y,
							dist = { x:Math.abs( ( dx + dxy.x ) / s.scalex ), y:Math.abs( ( dy + dxy.y ) / s.scaley ) }; // how far we have moved in x and y
					// square off the scaling
					if ( ev.shiftKey ) { // by the greatest distance between x and y
						if ( ev.ctrlKey || ev.metaKey ) {
							if ( dist.x / dxy.a > dist.y ) dist = { x:dist.x, y:dist.x / dxy.a };
							else dist = { x:dist.y * dxy.a, y:dist.y };
						} else { // by the shortest distance between x and y
							if ( dist.x / dxy.a < dist.y ) dist = { x:dist.x, y:dist.x / dxy.a };
							else dist = { x:dist.y * dxy.a, y:dist.y };
						}
					}
					var sxy = { x:dist.x / dxy.dx, y:dist.y / dxy.dy }; // new scaling based on the distance moved
					me.ui.canvas.Selection.forEach( function( item ) { // perform the scaling for each selected element
						var orig = ( item.data( 'orig-matrix' ) || new S.Matrix ).clone(), oi = orig.invert(), c = me.ui.canvas.zoom.for_pan( { x:dxy.acx, y:dxy.acy } );
						orig.scale( sxy.x, sxy.y, oi.x( c.x, c.y ), oi.y( c.x, c.y ) );
						item.transform( orig );
					} );
					me.adjust_bounds(); // adjust the bounding box for our tools, as you scale
				}
			}

			// controls scaling, based on moving the corner dots
			mvrs.forEach( function( el ) {
				el.drag( function( dx, dy, x, y, ev ) { // move
					ev.stopPropagation();
					last_dxy = { x:dx, y:dy };
					mvrs_move( ev );
				}, function( x, y, ev ) { // start
					ev.stopPropagation();
					me.e.sclr.addClass( 'scaling' );
					// record the original matrix for each selected element. all operations on the move action are done as 'diffs' from this transform, until the 'end' action
					me.ui.canvas.Selection.forEach( function( item ) { item.data( 'orig-matrix', ( item.matrix || new S.Matrix ).clone() ); } );
					// also record the base location of the 'middle dot', the location of our scaler as a whole, and the current angle of the corner we are rotating from.
					// these will all be used to properly calculate the transformation that needs to take place to provide a smooth, useful experience to the user
					var s = ( me.e.cntr.matrix || new S.Matrix ).split(), ms = ( this.parent().matrix || new S.matrix ).split(), ss = ( me.e.sclr.matrix || S.Matrix ).split();
					dxy = { cx:0, cy:0, x:ms.dx - s.dx, y:ms.dy - s.dy, acx:s.dx + ss.dx, acy:s.dy + ss.dy, ang:S.angle( 0, 0, ms.dx - s.dx, ms.dy - s.dy ) };
					dxy.dx = Math.abs( dxy.x );
					dxy.dy = Math.abs( dxy.y );
					dxy.a = Math.abs( dxy.x / dxy.y );
					// allow the shift, alt, ctrl, and meta key modifiers to instantly change the draw, instead of waiting until a mousemove occurs while they are pressed
					_on_keydown( 'a* s* c* 16 17 18 224', mvrs_move );
					_on_keyup( 'a* s* c* 16 17 18 224', mvrs_move );
					// allow the user to cancel this scaling action by hitting escape
					_enable_cancel( function() {
						// cancel the scaling
						me.e.sclr.removeClass( 'scaling' );
						// reset all selected elements to their original transforms
						me.ui.canvas.Selection.forEach( function( item ) { item.transform( item.data( 'orig-matrix' ) ); } );
						last_dxy = { x:0, y:0 };
						me.adjust_bounds(); // adjust the bounding box for our tools, as you scale
					} );
				}, function( ev ) { // end
					ev.stopPropagation();
					// store this transform in the undo list
					if ( me.e.sclr.hasClass( 'scaling' ) ) {
						me.e.sclr.removeClass( 'scaling' );
						me.ui.allow_undo_transform(
							me.ui.canvas.Selection.at( 0 ),
							function() {
								var i, ii;
								for ( i = 0, ii = this.data.obj_id.length; i < ii; i++ )
									me.ui.shp.select( '#' + this.data.obj_id[ i ] ).transform( this.data.m[ i ] );
							},
							function() {
								var i, ii;
								for ( i = 0, ii = this.data.obj_id.length; i < ii; i++ )
									me.ui.shp.select( '#' + this.data.obj_id[ i ] ).transform( this.data.om[ i ] );
							}
						);
					}
					// cleanup by removing our data on each selected element
					me.ui.canvas.Selection.forEach( function( item ) { item.removeData( 'orig-matrix' ); } );
					last_dxy = { x:0, y:0 };
					// remove the keybinds for modified scaling and escape cancelling
					_off_keydown( 'a* s* c* 16 17 18 224' );
					_off_keyup( 'a* s* c* 16 17 18 224' );
					_disable_cancel();
				} );
			} );

			// handles actions from our 'rotation' helpers
			rotrs.forEach( function( el ) {
				el.drag( function( dx, dy, x, y, ev ) { // move
					ev.stopPropagation();
					if ( me.e.sclr.hasClass( 'rotating' ) ) {
						var a = S.angle( dxy.cx, dxy.cy, dxy.x + dx, dxy.y + dy ) - dxy.ang;
						me.ui.canvas.Selection.forEach( function( item ) {
							var orig = item.data( 'orig-matrix' ).clone(), oi = orig.invert(), c = me.ui.canvas.zoom.for_pan( { x:dxy.acx, y:dxy.acy } );
							orig.rotate( a, oi.x( c.x, c.y ), oi.y( c.x, c.y ) );
							item.transform( orig );
						} );
					}
				}, function( x, y, ev ) { // start
					ev.stopPropagation();
					var par = this.parent();
					me.e.sclr.addClass( 'rotating' );
					// record the starting matrix for each selected element. all calculations on the move action will be diffs from this transform, until we reach the end action
					me.ui.canvas.Selection.forEach( function( item ) { item.data( 'orig-matrix', ( item.matrix || new S.Matrix ).clone() ); } );
					// also record the start position of the center dot, the offset of the entire scaler tool, and the current angle of the corner we are rotating from.
					// these will all be used to calculate the proper 'new angle' of each selected element
					var s = ( me.e.cntr.matrix || new S.Matrix ).split(), ms = ( this.parent().matrix || new S.matrix ).split(), ss = ( me.e.sclr.matrix || S.Matrix ).split();
					dxy = { cx:0, cy:0, x:ms.dx - s.dx, y:ms.dy - s.dy, acx:s.dx + ss.dx, acy:s.dy + ss.dy, ang:S.angle( 0, 0, ms.dx - s.dx, ms.dy - s.dy ) };
					_enable_cancel( function() {
						// cancel the scaling
						me.e.sclr.removeClass( 'rotating' );
						// reset all selected elements to their original transforms
						me.ui.canvas.Selection.forEach( function( item ) { item.transform( item.data( 'orig-matrix' ) ); } );
						me.adjust_bounds(); // adjust the bounding box for our tools, as you scale
					} );
				}, function( ev ) { // end
					ev.stopPropagation();
					// store this transform in the undo list
					if ( me.e.sclr.hasClass( 'rotating' ) ) {
						me.e.sclr.removeClass( 'rotating' );
						me.ui.allow_undo_transform(
							me.ui.canvas.Selection.at( 0 ),
							function() {
								var i, ii;
								for ( i = 0, ii = this.data.obj_id.length; i < ii; i++ )
									me.ui.shp.select( '#' + this.data.obj_id[ i ] ).transform( this.data.m[ i ] );
							},
							function() {
								var i, ii;
								for ( i = 0, ii = this.data.obj_id.length; i < ii; i++ )
									me.ui.shp.select( '#' + this.data.obj_id[ i ] ).transform( this.data.om[ i ] );
							}
						);
					}
					// cleanup by removing our data from each selected element
					me.ui.canvas.Selection.forEach( function( item ) { item.removeData( 'orig-matrix' ); } );
					_disable_cancel();
				} );
			} );
		};

		scaler.prototype = sproto;

		QS.cbs.add( 'canvas-start', function( paper, ui ) { paper.scaler = new scaler( ui, { ratio:1, ele:paper } ); paper.scaler.hide(); } );
	} );

	S.plugin( function( S, E, P, G, F ) {
		var dfproto = {},
				toggle_list = {
					small: 'df_mode',
					df_mode: 'small'
				},
				from_offset = { left:0, 'top':0 };

		function distraction_free( ui, paper ) {
			this.ui = ui;
			this.P = paper;
			this.mode = 'none';
			this.set_mode( 'small' );
		}

		dfproto.xy4mode = function( x, y ) {
			return ( 'small' == this.mode ) ? { x:x, y:y } : { x:x + from_offset.left, y:y + from_offset.top };
		};

		dfproto.set_mode = function( mode ) {
			if ( mode == this.mode || ! qt.isF( this[ 'mode_' + mode ] ) ) return;
			this.mode = mode;
			this[ 'mode_' + this.mode ]();
			this.ui.adjust_offset();
		};

		dfproto.toggle = function() {
			this.set_mode( toggle_list[ this.mode ] );
		};

		dfproto.mode_small = function() {
			this.ui.canvas.zoom.pan( this.ui.canvas.zoom.to_scale( -from_offset.left ), this.ui.canvas.zoom.to_scale( -from_offset.top ) );
			this.ui.e.main.removeClass( 'df-mode' );
		};

		dfproto.mode_df_mode = function() {
			from_offset = $.extend( {}, this.ui.canvas_off );
			this.ui.canvas.zoom.pan( this.ui.canvas.zoom.to_scale( from_offset.left ), this.ui.canvas.zoom.to_scale( from_offset.top ) );
			this.ui.e.main.addClass( 'df-mode' );
		};

		distraction_free.prototype = dfproto;

		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			paper.DF = new distraction_free( ui, paper );
		} )( 10 );
		QS.cbs.add( 'create-btns', function( t ) {
			t.utils.add_btn( {
				ele: t.toolbar.hud.path( 'M0,0L6,0L4,2L8,6L11,6L15,2L13,0L19,0L19,6L17,4L13,8L13,11L17,15L19,13L19,19L13,19L15,17L11,13L8,13L4,17L6,19L0,19L0,13L2,15L6,11L6,8L2,4L0,6z' ),
				only_click: true,
				name: 'fullscreen',
				title: 'Distraction Free',
				click: function() { t.canvas.DF.toggle(); }
			} );
		} )( -1 );
	} );

	// FIFO do/undo list
	S.plugin( function( S, E, P, G, F ) {
		var uproto = {},
				active = undefined;

		$( window ).on( 'keydown', function( e ) {
			if ( qt.is( active ) ) {
				switch ( e.which ) {
					case 90:
						if ( e.metaKey || e.ctrlKey ) {
							if ( ! e.shiftKey && active.can_undo() ) {
								active.undo( 1 );
							} else if ( e.shiftKey && active.can_redo() ) {
								active.redo( 1 );
							}
						}
					break;
				}
			}
		} );

		function cmd( fn, un, data ) {
			this.fn = qt.isF( fn ) ? fn : function() {};
			this.un = qt.isF( un ) ? un : function() {};
			this.data = data || {};
		}

		function undoer( paper ) {
			active = this;
			this.paper = paper;
			this.fifo = [];
			this.idx = -1;
		}
		undoer.cmd = cmd;

		uproto.can_undo = function( cnt ) {
			return this.fifo.length && this.idx >= ( cnt || 1 ) - 1;
		}

		uproto.can_redo = function( cnt ) {
			return this.fifo.length && this.idx + ( cnt || 1 ) < this.fifo.length;
		}

		uproto.get = function( back ) {
			var back = back || 0, i = this.idx - back;
			return this.fifo[ i ];
		}

		uproto.add = function( cmds, suppress ) {
			active = this;
			var suppress = suppress || false,
					cnt = 0,
					cmds = qt.isC( cmds, undoer.cmd ) ? [ cmds ] : cmds;

			if ( qt.isA( cmds ) ) {
				cmds = cmds.filter( function( cmd ) { return qt.isC( cmd, undoer.cmd ); } );
				if ( cmds.length ) {
					cnt = cmds.length;
					this.fifo.splice.apply( this.fifo, [ this.idx + 1, this.fifo.length - this.idx ].concat( cmds ) );
				}
			}

			if ( ! suppress && cnt ) {
				this.redo( cnt );
			} else if ( suppress && cnt ) {
				this.idx = this.fifo.length - 1;
			}

			return this;
		}

		uproto.replace = function( cmds, num, suppress ) {
			active = this;
			var suppress = suppress || false,
					cnt = 0,
					cmds = qt.isC( cmds, undoer.cmd ) ? [ cmds ] : cmds;

			if ( num > 0 ) {
				this.idx = this.idx - num;
				this.fifo = this.fifo.slice( 0, this.idx + 1 );
			}

			if ( qt.isA( cmds ) ) {
				cmds = cmds.filter( function( cmd ) { return qt.isC( cmd, undoer.cmd ); } );
				if ( cmds.length ) {
					cnt = cmds.length;
					this.fifo.splice.apply( this.fifo, [ this.idx + 1, this.fifo.length - this.idx ].concat( cmds ) );
				}
			}

			if ( ! suppress && cnt ) {
				this.redo( cnt );
			} else if ( suppress && cnt ) {
				this.idx = this.fifo.length - 1;
			}

			return this;
		}

		uproto.redo = function( cnt ) {
			active = this;
			var me = this,
					cnt = cnt || 1,
					ii = me.fifo.length,
					max = ii - me.idx - 1,
					diff = Math.min( max, cnt ),
					to = diff + me.idx;
			if ( to > me.idx ) while ( me.idx < to && ++me.idx > -1 ) {
				me.fifo[ me.idx ].fn( me.fifo[ me.idx ] );
			}

			this.changed( diff );

			return this;
		}

		uproto.undo = function( cnt ) {
			active = this;
			this.paper.Selection.clear();
			var me = this,
					cnt = cnt || 1,
					ii = -1,
					max = me.idx + 1,
					diff = -Math.min( max, cnt ),
					to = diff + me.idx;
			if ( to < me.idx ) do {
				me.fifo[ me.idx ].un( me.fifo[ me.idx ] );
			} while ( --me.idx > to );

			this.changed( diff );

			return this;
		}

		uproto.changed = function( diff ) {
			QS.cbs.trigger( 'undoer-changed', [ this, diff ] );
		}

		undoer.prototype = uproto;

		S.Undoer = undoer;
		

		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			paper.U = new undoer( paper );
		} )( 10 );
		QS.cbs.add( 'create-btns', function( t ) {
			t.toolbar.add_btn( {
				ele: t.toolbar.hud.path( 'M0,7L7,0L7,14z' ),
				only_click: true,
				name: 'undo',
				title: 'Undo',
				click: function() { t.canvas.U.undo( 1 ); }
			} );

			t.toolbar.add_btn( {
				ele: t.toolbar.hud.path( 'M20,7L13,0L13,14z' ),
				only_click: true,
				name: 'redo',
				title: 'Redo',
				click: function() { t.canvas.U.redo( 1 ); }
			} );
		} )( -5 );
	} );

	// create a global 'set' that tracks which elements on the paper are 'selected', and therefore being edited
	S.plugin( function( S, E, P, G, F ) {
		P.prototype['next_name'] = function() { return ''; };

		// group elements that are 'probably' in the same row. do this by applying two tests to an ordered list of elements to determine if they belong in a given row
		function group_by_dist_from_line( items, line, key_func, dev_func, slope_dev_func ) {
			// slope test function. determines if the slope of the current element is close enough to the average slopes of the items in the group, in relation to the first element in the group
			var slope_dev_func = qt.isF( slope_dev_func ) ? slope_dev_func : function( a, b ) { return a == b || ( b > 0 && 0.9 * a < b && b < 1.1 * a ) || ( 0.9 * a > b && b > 1.1 * a ); },
					// distance test function. determines if the distance this element is from the supplied line is close enough to the other distances of the elements in the group
					dev_func = qt.isF( dev_func ) ? dev_func : function( v ) { return 0.9 * ( v / 2 ); },
					// the function to 'sub group' the matches, so that offset rows do not produce offset sequences
					key_func = qt.isF( key_func ) ? key_func : function( v ) { return v.new_zone_name; },
					dir = dir || 1, bbx = [], groups = {}, avg_dia = 0, total_dia = 0, dev = 0, grouped = false, mine, avg, b, i, j, k;

			// first gather some basic, needed information about each element, which will be used in all of our tests
			for ( i = 0; i < items.length; i++ ) ( function( item ) {
				var tmp
				tmp = {
					key: key_func( item ),
					item: item,
					bbox: item.getBBox() // bbox contains the center of the rendered element, which is what we use to determine slopes and distances
				};
				tmp.ldist = qt.lineDist( { x:tmp.bbox.cx, y:tmp.bbox.cy }, line[0], line[1] ); // calc the distance, since that only requires knowing the line and the center of the element
				total_dia += (tmp.bbox.r2 * 2); // tally the diameter, which will be used in the function that calcs the distance deviation amount
				bbx.push( tmp ); // add the item and it's bbox description to the list of elements to work with
			} )( items[ i ] );

			// calc the average diameter of the bboxes. we feed this into our 'allowed distance deviation' function to figure out the range that is acceptable for distances from the line, to be considered in the same row
			avg_dia = total_dia / items.length;
			// use the avg diameter to figure out the range we will allow a distance to be in and still allow the distnace to classify this element into a group
			dev = dev_func( avg_dia );

			// sort all the elements by their distance from the line, which will help with the classification
			bbx.sort( function( a, b ) { return a.ldist - b.ldist; } );

			// start the tests on the sorted list of elements
			for ( i = 0; i < bbx.length; i++ ) {
				grouped = false;

				// if teh sub grouping does not exist yet, then create it
				if ( ! qt.is( groups[ bbx[ i ].key ] ) ) groups[ bbx[ i ].key ] = [];

				// test the element against all known groups in this sub grouping
				for ( j = 0; j < groups[ bbx[ i ].key ].length; j++ ) {
					// perform the distance test. is distance is within the accepted deviation from the supplied line, to fit in this group?
					if ( groups[ bbx[ i ].key ][ j ].min <= bbx[ i ].ldist && bbx[ i ].ldist <= groups[ bbx[ i ].key ][ j ].max ) {
						// if the element fits this criteria, tnen calc it's slope from the first element in the group, and add that to our total slopes, which is used in later slope tests, and add the element to the group
						groups[ bbx[ i ].key ][ j ].tot_slope += ( groups[ bbx[ i ].key ][ j ].items[0].bbox.cy - bbx[ i ].bbox.cy ) / ( groups[ bbx[ i ].key ][ j ].items[0].bbox.cx - bbx[ i ].bbox.cx );
						groups[ bbx[ i ].key ][ j ].items.push( bbx[ i ] );
						grouped = true;
						break;
					}

					// if the first test failed, catch any stragglers by comparing the slope from the first element in this group with the average slopes of all the other elements in the group, allowing for some deviation,
					// which is defined by the slope_dev_func function
					if ( groups[ bbx[ i ].key ][ j ].items.length > 1 ) {
						// this elements slope from the first element in the group
						mine = ( groups[ bbx[ i ].key ][ j ].items[0].bbox.cy - bbx[ i ].bbox.cy ) / ( groups[ bbx[ i ].key ][ j ].items[0].bbox.cx - bbx[ i ].bbox.cx );
						// the average slopes of the other elements in the group from the first
						avg = groups[ bbx[ i ].key ][ j ].tot_slope / ( groups[ bbx[ i ].key ][ j ].items.length - 1 );

						// does the deviation function say that it falls within the acceptable range of deviance?
						if ( slope_dev_func( avg, mine ) ) {
							// add the slope to the total slope and add the element to the group
							groups[ bbx[ i ].key ][ j ].tot_slope += mine;
							groups[ bbx[ i ].key ][ j ].items.push( bbx[ i ] );
							grouped = true;
							break;
						}
					}
				}

				// if the element does not belong to an existing group yet, then create a new group with this as the first element
				if ( ! grouped ) {
					groups[ bbx[ i ].key ].push( {
						min: bbx[ i ].ldist,
						max: bbx[ i ].ldist + dev,
						tot_slope: 0,
						items: [ bbx[ i ] ]
					} );
				}
			}

			// order the groups according to the supplied direction 
			//groups.sort( function( a, b ) { return a.min == b.min ? 0 : ( dir < 0 ? ( a.min < b.min ? -1 : 1 ) : ( b.min < a.min ? 1 : -1 ) ); } );

			return groups;
		}

		// settings box
		function SB( ui ) {
			this.ui = ui;
			this.e = {};
			this.data = {};
			this.fields = {};
			this._setup_elements();
			this._setup_events();
		}

		var sbproto = {};

		sbproto.open = function() {
			var me = this, i = 0, last_ku = '';
			this.hide_fields();
			this.show_fields();
			this.e.sBox.show();
			return this;
		};

		sbproto.close = function() {
			this.e.sBox.hide();
			this.hide_fields();
			return this;
		};

		sbproto.show_fields = function() {
			var me = this, k;
			for ( k in me.data ) if ( me.data[ has ]( k ) ) ( function( f, d, i ) {
				var item = $.extend( { type:'text', options:[], onchange:function(){}, value:'', multiple:false, title:false, name:k, min:'', max:'', step:'', advanced:false, only_if:false, update_trigger:false }, me.data[ k ] ),
						a = d.attr.slice().shift();
				if ( ! a ) return;
				f.field
					.off( 'alt-change.qs-field' ).on( 'alt-change.qs-field', function( e, func ) {
						qt.isF( func ) && d.onchange( func, a, f, d, e );
					} )
					.off( 'change.qs-field' ).on( 'change.qs-field', function( e ) {
						qt.isF( d.onchange ) && d.onchange( $( this ), a, f, d, e );
					} )
					.off( 'keyup.qs-field' ).on( 'keyup.qs-field', function( e ) {
						if ( $.inArray( e.which, [ 16, 17, 18, 224, 33, 34, 35, 36, 37, 38, 39, 40, 45, 46, 13, 20, 27, 9 ] ) > -1 ) return;
						var my_ku = ( Math.random() * 1000000 ) + '-' + ( Math.random() * 10000000 ), el = this;
						last_ku = my_ku;
						setTimeout( function() {
							if ( last_ku != my_ku ) return;
							qt.isF( d.onchange ) && d.onchange( $( el ), a, f, d, e );
						}, 350 );
					} );
				f.html.appendTo( item.advanced ? me.e.aBoxIn : me.e.sBoxIn );
			} )( me.fields[ k ], me.data[ k ], k );
			return this;
		};

		sbproto.hide_fields = function() {
			var i = 0;
			for ( i in this.fields ) if ( this.fields[ has ]( i ) ) {
				this.fields[ i ].field.off( 'change.qs-field keyup.qs-field' );
				this.fields[ i ].html.appendTo( this.e.holder );
			};
			return this;
		};

		sbproto.set_data = function( data ) {
			var me = this, i = 0;
			me.data = data;

			for ( k in me.data ) if ( me.data[ has ]( k ) ) {
				var item = $.extend( { type:'text', options:[], onchange:function(){}, value:'', multiple:false, title:false, name:k, min:'', max:'', step:'', advanced:false, only_if:false, update_trigger:false, cnt:0 }, me.data[ k ] );

				if ( qt.is( me.fields[ k ] ) ) {
					switch ( item.type || 'text' ) {
						case 'truefalse':
							me.fields[ k ].field[ qt.toInt( me.data[ k ].value ) ? 'attr' : 'removeAttr' ]( 'checked', 'checked' );
						break;
						case 'checkbox':
						case 'radio':
							me.fields[ k ].field.removeAttr( 'checked' ).filter( '[value="' + me.data[ k ].value + '"]' ).attr( 'checked', 'checked' );
						break;
						case 'select':
							me.fields[ k ].field.find( 'option' ).removeAttr( 'selected' ).filter( '[value="' + me.data[ k ].value + '"]' ).attr( 'selected', 'selected' );
						break;
						case 'colorpicker':
							me.fields[ k ].field.val( me.data[ k ].value ).trigger( 'updated' );
							me.fields[ k ]._cp_shell.iris( 'color', me.data[ k ].value );
						break;

						default:
						case 'text':
						case 'number':
						case 'textarea':
							me.fields[ k ].field.val( me.data[ k ].value );
						break;
					}
					continue;
				}

				var tmp = {
					html: $( '<div class="field"><label class="field-name"></label><div class="field-fields"></div></div>' ).appendTo( me.e.holder ),
					field: $(),
					advanced: item.advanced
				};

				if ( qt.is( item.name ) )
					tmp.html.find( '.field-name' ).html( item.name );
				else
					tmp.html.find( '.field-name' ).remove();

				var title = qt.isS( item.title ) && item.title.length ? ' title="' + qt.esc( item.title ) + '" ' : '';

				var ff = tmp.html.find( '.field-fields' );
				switch ( item.type || 'text' ) {
					case 'truefalse':
						var state = qt.toInt( item.value ) ? 'checked="checked"' : '',
								f = $( '<input type="checkbox" name="'+ k + '" value="1" ' + title + state + '/>' ).appendTo( ff ).wrap( '<span class="cb-wrap"></span>' );
						$( '<span class="cb-label">' + __( 'Yes' ) + '</span>' ).insertAfter( f );
						$( '<input type="hidden" name="' + k + '" value="0" />' ).insertBefore( f );
						tmp.field = tmp.field.add( f );
					break;

					case 'checkbox':
					case 'radio':
						if ( qt.isA( item.options ) && item.options.length ) {
							var suffix = item.multiple ? '[]' : '';
							for ( i = 0; i < item.options; i++ ) {
								var state = item.options[ i ].state ? 'checked="checked"' : '',
										f = $( '<input type="' + item.type + '" name="' + k + suffix + '" value="' + item.options[ i ].value + '" ' + title + state + '/>' ).appendTo( ff ).wrap( '<span class="cb-wrap"></span>' );
								$( '<span class="cb-label">' + item.options[ i ].label + '</span>' ).insertAfter( f );
								tmp.field = tmp.field.add( f );
							}
						}
					break;

					case 'select':
						if ( qt.isA( item.options ) && item.options.length ) {
							var suffix = item.multiple ? '[]' : '';
							tmp.field = tmp.field.add( $( '<select class="widefat" name="' + k + suffix + '"' + title + '></select>' ).appendTo( ff ) );
							for ( i = 0; i < item.options; i++ ) {
								var selected = '';
								if ( ! item.multiple && item.value == item.option[ i ].value ) selected = 'selected="selected"';
								else if ( item.multiple && qt.isA( item.value ) && $.inArray( item.options[ i ].value, item.value ) > -1 ) selected = 'selected="selected"';
								$( '<option value="' + item.options[ i ].value + '" ' + selected + '>' + item.option[ i ].label + '</option>' ).appendTo( tmp.field );
							}
						}
					break;

					case 'textarea':
						var f = $( '<textarea class="widefat" name="' + k + '"' + title + '>' + item.value + '</textarea>' ).appendTo( ff );
						tmp.field = tmp.field.add( f );
					break;

					case 'colorpicker':
						var f = $( '<input type="text" name="' + k + '" value="' + item.value + '" ' + title + '/>' ).appendTo( ff );
						tmp.field = tmp.field.add( f );
						( function( t ) {
							var down = false;
							function _close() { if ( ! down ) t._cp_shell.trigger( 'close' ); }

							t.field.on( 'updated.cp', function( ev, color ) {
								var color = color || Color( t.field.val() );
								t.field.val( color.toString() ).css( {
									color: color.v() > 50 ? '#000' : '#fff',
									backgroundColor: color.toString()
								} ).change();
							} ).trigger( 'updated' );

							t._cp_shell = $( '<div class="sb-cp-shell"></div>' ).appendTo( 'body' ).iris( {
								color: item.value ? ( '#000' == item.value || '#000000' == item.value ? { h:0, s:100, v: 0 } : item.value ) : { h:0, s:100, v: 0 },
								width: 300,
								mode: 'hsv',
								change: function( ev, ui ) {
									t.field.trigger( 'updated', [ ui.color ] );
								},
								clear: function( ev, ui ) {
									t.field.val( 'transparent' ).css( { color:'#000', backgroundColor:'#fff' } ).change();
								}
							} ).on( {
								'close.cp': function() {
									$( this ).removeClass( 'open' );
									t._cp_shell_close.hide();
									t._cp_shell.iris( 'hide' );
									_off_keyup( '~27 ~13', 'color-pick' );
									$( window ).off( 'click.cp' );
								},
								'open.cp': function() {
									$( this ).addClass( 'open' );
									t._cp_shell.iris( 'show' ).trigger( 'change' );
									var pos = t.field.offset(), dims = { width:t.field.outerWidth(), height:t.field.outerHeight() },
											w = $( window ), wdims = { width:w.outerWidth(), height:w.outerHeight() },
											i = t._cp_shell.find( '.iris-picker' ), idims = { width:i.outerWidth(), height:i.outerHeight() },
											css = { left:pos.left, top:pos.top }, pcss = { top:dims.height, left:0 };
									if ( css.top + pcss.top + idims.height > wdims.height ) $.extend( pcss, { top:'', bottom:idims.height } );
									if ( css.left + pcss.left + idims.width > wdims.width ) {
										$.extend( css, { left:pos.left + dims.width } );
										$.extend( pcss, { left:'', right:idims.width } );
									}
									t._cp_shell_close.show();
									t._cp_shell.css( css );
									t.field.trigger( 'updated', [ Color( t.field.val() ) ] );
									i.css( pcss );
									_on_keyup( '~27 ~13', _close, 'color-pick' );
									$( window ).on( 'click.cp', _close );
								},
								'toggle.cp': function( ev ) {
									if ( $( this ).hasClass( 'open' ) ) {
										$( this ).trigger( 'close' );
									} else {
										$( this ).trigger( 'open' );
									}
								}
							} );

							// fix chrome's dumb click send after drag on the slider control
							t._cp_shell.find( '.iris-picker' ).on( 'mousedown click', function( ev ) { ev.stopPropagation(); down = true; } );
							$( window ).on( 'mouseup', function( ev ) { down = false; } );

							t._cp_shell_close = $( '<div class="cp-shell-close">X</div>' ).appendTo( t._cp_shell ).click( function() { t._cp_shell.trigger( 'close' ); } )
							t.field
								.on( {
									'focus.cp': function( ev ) { ev.stopPropagation(); t._cp_shell.trigger( 'open' ); },
									'dblclick.cp': function( ev ) { ev.stopPropagation(); },
									'click.cp': function( ev ) { ev.stopPropagation(); }
								} );
						} )( tmp );
					break;

					case 'number':
						var f = $( '<input type="number" class="widefat" name="' + k + '" value="' + item.value + '" step="' + item.step + '" min="' + item.min + '" max="' + item.max + '"' + title + ' />' ).appendTo( ff );
						tmp.field = tmp.field.add( f );
					break;

					case 'namer':
						( function( ff, item, title, tmp ) {
							var d = $( '<div class="namer"></div>' ).appendTo( ff ),
									f = $( '<input type="text" class="widefat" name="' + qt.esc( k ) + '" value="' + qt.esc( item.value ) + '"' + qt.esc( title ) + ' />' ).appendTo( d ),
									a = $( '<div class="namer-actions"></div>' ).appendTo( d ),
									p = $( '<a href="javascript:;">' + __( 'pattern' ) + '</a>' ).appendTo( d ).off( '.namer' ).on( 'click.namer', function() { f.trigger( 'do-pattern' ); } ),
									r = $( '<a href="javascript:;">' + __( 'replace' ) + '</a>' ).appendTo( d ).off( '.namer' ).on( 'click.namer', function() { f.trigger( 'do-replace' ); } );
							$( '<span class="divider"> | </div>' ).insertBefore( r );

							f.off( '.namer' )
								.on( 'do-pattern.namer', function() {
									var that = $( this );

									function handle_prompt_response( ptrn ) {
										if ( null === ptrn && ptrn.length ) return;
										var i, j, k;

										that.trigger( 'alt-change', function( items, attr, field, ev ) {
											for ( i = 0; i < items.length; i++ ) items[ i ].new_zone_name = ptrn;
										} );

										var map = {
													'#': { msg:__( 'Draw a line in the direction of numbers lowest to highest.' ), g:function( a, b, c ) { var b = b || 1, c = c || 1; return ( c * a ) + qt.toInt( b ); } },
													'@': { msg:__( 'Draw a line in the direction of letters "a" to "z".' ), g:function( a, b, c ) {
														var out = '', x = 26, b = b.toLowerCase(), o = b ? b.charCodeAt( 0 ) : 97, n = ( c * a ), r;
														do {
															r = n % x;
															out = out + String.fromCharCode( r + o )
														} while ( n = Math.floor( n / x ) );
														return out;
													} },
													'^': { msg:__( 'Draw a line in the direction of letters "A" to "Z".' ), g:function( a, b, c ) {
														var out = '', x = 26, b = b.toUpperCase(), o = b ? b.charCodeAt( 0 ) : 65, n = ( c * a ), r;
														do {
															r = n % x;
															out = out + String.fromCharCode( r + o )
														} while ( n = Math.floor( n / x ) );
														return out;
													} }
												}, msg_cont;

										function get_a_line_from_user( msg, with_line ) {
											me.ui.e.main.addClass( 'svg-events-only' );

											msg_cont = $( '<div class="ui-action-required">' + msg + '</div>' ).insertBefore( me.ui.e.canvas );

											me.ui.canvas.Selection.disable();
											var lf = ( new QS.LineFactory( me.ui ) ).btn_start_active( null, null, function( line ) {
												var d = qt.dist( line[0].x, line[0].y, line[1].x, line[1].y );
												if ( d >= 5 ) {
													lf.btn_end_active();
													me.ui.canvas.Selection.enable();
													me.ui.e.main.removeClass( 'svg-events-only' );
													msg_cont.remove();
													with_line( line );
												} else {
													msg_cont.html( msg + '<br/><u><em>the line must be at least 5px long. <b>(' + d + ')</b></em></u>' );
												}
											} );
										}

										// doing it this way allows for multiple replacements without infinite loops, since we have to wait on action from the user between some iterations
										function do_replacements( i ) {
											var i = i || 0;
											while ( i < ptrn.length ) {
												var chr = ptrn.charAt( i ), find, chr_len = 1, start = '', alternate = 1, close = 0;
												if ( ! qt.is( map[ chr ] ) ) {
													i++;
													continue;
												}

												find = chr;
												chr_len = 1;

												if ( ptrn.charAt( i + 1 ) == '[' ) {
													close = ptrn.indexOf( ']', i + 1 );
													find = ptrn.substring( i, close + 1 );
													chr_len = find.length;
													start = find.substr( 2, chr_len - 3 ).split( /,/ ); // 3 = 2 at the beginning and 1 at the end
													if ( start.length >= 2 ) alternate = Math.abs( start[1] );
													start = start[0];
												}

												find = find.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

												( function( i, chr, start, chr_len, alternate ) {
													get_a_line_from_user( map[ chr ].msg, function( line ) {
														that.trigger( 'alt-change', function( items, attr, field, ev ) {
															var dang = S.angle( line[0].y, line[1].x, line[1].y, line[0].x ) - S.angle( line[0].x, line[0].y, line[1].x, line[1].y ),
																	calc_line = dang < 0 ? [ { x:line[0].y, y:line[1].x }, { x:line[1].y, y:line[0].x } ] : [ { x:line[1].y, y:line[0].x }, { x:line[0].y, y:line[1].x } ],
																	groups = group_by_dist_from_line( items, calc_line, false, function( avg_dia ) { return ( avg_dia / 2 ); } ), j, k, l;

															for ( l in groups ) if ( groups[ has ]( l ) )
																groups[ l ].sort( function( a, b ) { return a.min == b.min ? 0 : ( ( dang < 0 && a.min < b.min ) || ( dang > 0 && a.min > b.min ) ? 1 : -1 ); } );

															for ( l in groups ) if ( groups[ has ]( l ) )
																for ( j = 0; j < groups[ l ].length; j++ )
																	for ( k = 0; k < groups[ l ][ j ].items.length; k++ )
																		groups[ l ][ j ].items[ k ].item.new_zone_name = groups[ l ][ j ].items[ k ].item.new_zone_name.replace( new RegExp( find ), map[ chr ].g( j, start, alternate ) );

															do_replacements( i + chr_len );
														} );
													} );
												} )( i, chr, start, chr_len, alternate );
												//break;
												return;
											}

											if ( i >= ptrn.length ) {
												that.trigger( 'alt-change', function( items, attr, field, ev ) {
													for ( i = 0; i < items.length; i++ ) {
														items[ i ].attr( { zone:items[ i ].new_zone_name/*, id:items[ i ].new_zone_name.toLowerCase().replace( /[^a-z0-9]+/gi, '-' ).replace( /-+/, '-' ) */ } );
														delete items[ i ].new_zone_name;
													}
												} );
											}
										}

										do_replacements( 0 );
									}

									QS.Prompt( {
										title: 'Naming by Pattern',
										msg: __( "What is the naming pattern you would like to use?" ),
										helper: __( "^ = A-Z<br/>@ = a-z<br/># = 0-9<br/>[x,y] = start from value 'x', alternate every 'y'<br/>(ex: 'north-@[b]-#[3,2]' = odd numbered seats starting at 'north-b-3')" ),
										def: '^-#',
										with_result: handle_prompt_response
									} );
								} )
								.on( 'do-replace.namer', function() {
									var that = $( this ), current = [], aname = item.attr.slice().shift(), i, k, m;
									if ( ! aname ) return;

									QS.Prompt( {
										title: 'What to find:',
										msg: __( 'What text would you like to find, within each name (regex without delimiters is accepted)?' ),
										with_result: function( find ) {
											if ( null === find ) return;

											QS.Prompt( {
												title: 'Replace it with what?',
												msg: __( 'What text would you like to find, within each name (regex without delimiters is accepted)?' ),
												with_result: function( replace ) {
													if ( null === replace ) return;

													try {
														var find_regex = new RegExp( find, 'g' );
													} catch( e ) {
														var find_regex = new RegExp( find.replace( /([\[\(\\\)\]\{\}\.\?\+\@\!\:\=])/g, '\\\1' ), 'g' )
													}

													that.trigger( 'alt-change', function( items, attr, field, ev ) {
														for ( i = 0; i < items.length; i++ )
															items[i].attr( aname, items[ i ].attr( aname ).replace( find_regex, replace ) );
														QS.cbs.trigger( 'selection-changed' );
													} );
												}
											} );
										}
									} );
								} );

							tmp.field = tmp.field.add( f );
						} )( ff, item, title, tmp );
					break;

					default:
					case 'text':
						var f = $( '<input type="text" class="widefat" name="' + k + '" value="' + item.value + '"' + title + ' />' ).appendTo( ff );
						tmp.field = tmp.field.add( f );
					break;
				}

				me.fields[ k ] = tmp;
			}

			return this;
		};

		sbproto._setup_elements = function() {
			this.e.sBox = $( '<div class="qsot-settings-box BS"></div>' ).css( { display:'none' } ).appendTo( 'body' );
			this.e.sBoxIW = $( '<div class="inner-wrap"></div>' ).appendTo( this.e.sBox );
			this.e.holder = $( '<div class="holder"></div>' ).appendTo( this.e.sBoxIW );
			this.e.sBoxIn = $( '<div class="inner"></div>' ).appendTo( this.e.sBoxIW );
			this.e.advTog = $( '<div class="adv-tog inner sect-tog" rel="advanced"><a class="show" href="#">' + __( 'show advanced' ) + '</a><a class="hide" href="#">' + __( 'hide advanced' ) + '</a></div>' ).appendTo( this.e.sBoxIW );
			this.e.aBoxIn = $( '<div class="advanced inner"></div>' ).appendTo( this.e.sBoxIW );
			this.e.hndl = $( '<div class="sb-hndl BS"><div class="sb-hndl-in BS"></div><div class="sb-hndl-in BS"></div></div>').appendTo( this.e.sBox );
			QS.cbs.trigger( 'settings-box-setup-elements', [ this ] );
		};

		sbproto._setup_events = function() {
			var s = { x:0, y:0, dx:0, dy:0, on:this.e.sBox, off:false, down:false }, me = this;

			function _calc_scrollable() {
				if ( 'none' == me.e.sBox.css( 'display' ) ) return;
				me.e.sBox.removeClass( 'too-long' );
				if ( me.e.sBoxIW.innerHeight() > me.e.sBox.innerHeight() )
					me.e.sBox.addClass( 'too-long' );
			}
			$( window ).resize( _calc_scrollable );

			this.e.sBox.on( 'click', '.sect-tog a', function( e ) {
				e.preventDefault();
				var sect_tog = $( this ).closest( '.sect-tog' ), sect = sect_tog.attr( 'rel' );
				if ( me.e.sBox.hasClass( 'shown-' + sect ) ) {
					me.e.sBox.removeClass( 'shown-' + sect );
				} else {
					me.e.sBox.addClass( 'shown-' + sect );
				}

				_calc_scrollable();
			} );

			this.e.hndl
				.on( 'mousedown', function( ev ) {
					$.extend( s, {
						x: ev.pageX,
						y: ev.pageY,
						off: s.on.position(),
						down: true
					} );
				} );
			$( window )
				.on( 'mousemove', function( ev ) {
					if ( ! s.down ) return;
					ev.preventDefault();
					var dims = { width:s.on.width(), height:s.on.height() }, w = $( window ), wdims = { width:w.width(), height:w.height() }, poff = s.on.offsetParent().offset(), npos = {
							left: ( ev.pageX - s.x ) + s.off.left,
							top: ( ev.pageY - s.y ) + s.off.top,
							right: 'auto',
							bottom: 'auto'
						},
						clamp = { nx:-poff.left, ny:-poff.top, xx:wdims.width - dims.width - poff.left, xy:wdims.height - dims.height - poff.top };
					npos.left = npos.left < clamp.nx ? clamp.nx : npos.left;
					npos.top = npos.top < clamp.ny ? clamp.ny : npos.top;
					npos.left = npos.left > clamp.xx ? clamp.xx : npos.left;
					npos.top = npos.top > clamp.xy ? clamp.xy : npos.top;
					$( s.on ).css( npos );
				} )
				.on( 'mouseup', function( ev ) {
					if ( ! s.down ) return;
					ev.preventDefault();
					s.x = s.y = s.dx = s.dy = 0;
					s.off = s.down = false;
				} );
		};

		SB.prototype = sbproto;



		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			var only_zoom_zones = function( el ) { return el.hasClass( 'zoom-zone' ); },
					update_on = [ 'selection-move-end' ],
					normalize = function( val, ele, m, attr ) {
						switch ( attr ) {
							case 'x':
							case 'cx':
								val = qt.toFloat( val ) + qt.toFloat( m.dx );
							break;

							case 'y':
							case 'cy':
								val = qt.toFloat( val ) + qt.toFloat( m.dy );
							break;
						}
						return val;
					},
					fields = {
						_all: {
							zone_id: { type:'none', name:'True ID', attr:[ 'zone-id' ], hidden:true },
							id: { type:'text', name:'Unique ID', attr:[ 'id' ], single:true, advanced:true, title:'Think of this as the "slug" to identify this zone uniquely from the others, like a post would have.'},
							zone: { type:'namer', name:'Name', attr:[ 'zone' ], title:'The proper name of this zone, displayed in most locations that this zone needs to be identified, like on tickets, carts, or ticket selection UIs.' },
							capacity: { type:'number', name:'Capacity', attr:[ 'capacity' ], title:'The maximum number of tickets that can be sold for this zone, on a given event.' },
							fill: { type:'colorpicker', name:'Fill Color', attr:[ 'fill' ], filter:function( v ) { return Color( v ).toString(); }, title:'What color should the inside of the shape for this zone be?' },
							hidden: { type:'truefalse', name:'Hidden on Frontend', attr:[ 'hidden' ], advanced:true, title:'If yes, then this element does not get displayed to the end user.' },
							locked: { type:'truefalse', name:'Locked in Place', attr:[ 'locked' ], advanced:true, title:'If yes, then attempts to drag this element will not work.' },
							'fill-opacity': { type:'number', min:0, max:1, step:0.01, name:'Fill Transparency', attr:[ 'fill-opacity' ],
									filter:function( v ) { return qt.pl( v, 2 ); }, advanced:true, title:'Transparency of the inside of the zone.' },
							'unavail-fill': { type:'colorpicker', name:'Unavailable Color', attr:[ 'unavail-fill' ], advanced:true,
									filter:function( v ) { return Color( v ).toString(); }, title:'What color should the inside of the zone be when it has reached capacity?' },
							'unavail-fill-opacity': { type:'number', min:0, max:1, step:0.1, name:'Unavailable Transparency', attr:[ 'unavail-fill-opacity' ], advanced:true, title:'Transparency of the inside of the zone, when at capacity' },
							angle: { type:'none', name:'Angle', attr:[], func:function( args, i, m ) { return m.rotate; }, hidden:true }
						},
						_zz: {
							zoom_level: { type:'number', name:'Show Level', attr:[ 'zoom-lvl' ], filter:function( v ) { return qt.pl( v, 3 ); }, title:'Show this zoom zone when zoom level is less than or equal to this number.' }
						},
						image: {
							'image-id': { type:'none', name:'Image ID', attr:[ 'image-id' ], hidden:true },
							src: { type:'none', name:'Source', attr:[ 'src' ], hidden:true },
							width: { type:'none', name:'Image Width', attr:[ 'width' ], hidden:true },
							height: { type:'none', name:'Image Height', attr:[ 'height' ], hidden:true },
							x: { type:'none', name:'Image Offset X', attr:[ 'x' ], hidden:true },
							y: { type:'none', name:'Image Offset Y', attr:[ 'y' ], hidden:true },
							bg: { type:'truefalse', name:'Backdrop Image', attr:[ 'bg-img' ], title:'If yes, then the displayed canvas on the frontend will use this image as the background image of the interface' }
						},
						circle: {
							cx: { type:'number', name:'X Center', attr:[ 'cx', 'x' ], matrix:'dx', update_triggers:update_on, advanced:true },
							cy: { type:'number', name:'Y Center', attr:[ 'cy', 'y' ], matrix:'dy', update_triggers:update_on, advanced:true },
							r: { type:'number', min:0, max:360, step:1, name:'Radius', attr:[ 'r' ], update_triggers:update_on, advanced:true }
						},
						ellipse: {
							cx: { type:'number', name:'X Center', attr:[ 'cx', 'x' ], matrix:'dx', update_triggers:update_on, advanced:true },
							cy: { type:'number', name:'Y Center', attr:[ 'cy', 'y' ], matrix:'dy', update_triggers:update_on, advanced:true },
							rx: { type:'number', min:0, max:360, step:1, name:'Radius', attr:[ 'rx' ], update_triggers:update_on, advanced:true },
							ry: { type:'number', min:0, max:360, step:1, name:'Radius', attr:[ 'ry' ], update_triggers:update_on, advanced:true }
						},
						rect: {
							'hover-fill': { type:'colorpicker', name:'Color on Hover', title:'Background color when element is hovered.', attr:[ 'hover-fill' ], update_triggers:update_on, only_if:only_zoom_zones, advanced:true },
							'hover-fill-opacity': { type:'number', name:'Opacity on Hover', title:'Background opacity when element is hovered.', attr:[ 'hover-fill-opacity' ], update_triggers:update_on, only_if:only_zoom_zones, advanced:true },
							zmin: { type:'number', name:'Show Max Zoom Level', title:'Only show when the zoom is equal to or less than this value.', attr:[ 'min-zoom' ], update_triggers:update_on, only_if:only_zoom_zones, advanced:true },
							x: { type:'number', name:'X Upper Left', attr:[ 'x' ], matrix:'dx', update_triggers:update_on, advanced:true },
							y: { type:'number', name:'Y Upper Left', attr:[ 'y' ], matrix:'dy', update_triggers:update_on, advanced:true },
							width: { type:'number', name:'Width', attr:[ 'width' ], update_triggers:update_on, advanced:true },
							height: { type:'number', name:'Height', attr:[ 'height' ], update_triggers:update_on, advanced:true }
						},
						polygon: {
							x: { type:'number', name:'X Upper Left', attr:[ 'x' ], matrix:'dx', update_triggers:update_on, advanced:true },
							y: { type:'number', name:'Y Upper Left', attr:[ 'y' ], matrix:'dy', update_triggers:update_on, advanced:true },
							points: { type:'text', name:'Path Points', title:'space between points and comma between x and xy: (ei: 0,0 10,0 10,10 0,10)', attr:[ 'points' ], advanced:true, update_triggers:update_on, advanced:true }
						}
					};

			QS.cbs.trigger( 'settings-box-fields', [ fields, paper, ui ] );


			QS.cbs.add( 'before-save-seating', _pack_settings_and_zones );

			function _pack_zones( node ) {
				var zones = [], zzones = [], i, j, tmp, tag, found, ele, m, kind;
				$( node ).children().each( function() {
					tag = this.tagName.toLowerCase();
					tmp = { _type:tag, _order:$( this ).prevAll().length };
					ele = S.node4ele( this );
					kind = tmp._subtype = ele.attr( 'kind' );
					m = ( ele.matrix || ( new S.Matrix ) ).split();
	
					for ( i in fields._all ) if ( fields._all[ has ]( i ) ) {
						found = null
						if ( qt.isF( fields._all[ i ].func ) ) {
							found = tmp[ i ] = fields._all[ i ].func.call( ele, fields._all[ i ], i, m );
						} else if ( qt.isA( fields._all[ i ].attr ) ) {
							for ( j = 0; j < fields._all[ i ].attr.length; j++ ) {
								found = qt.is( cssAttr[ fields._all[ i ].attr[ j ] ] ) ? $( this ).css( fields._all[ i ].attr[ j ] ) : $( this ).attr( fields._all[ i ].attr[ j ] );
								if ( qt.is( found ) ) {
									tmp[ i ] = normalize( found, ele, m, fields._all[ i ].attr[ j ] );
									break;
								}
							}
						}
						if ( found && qt.isF( fields._all[ i ].filter ) )
							tmp[ i ] = fields._all[ i ].filter( tmp[ i ] );
					}
	
					if ( 'zoom-zone' == kind ) for ( i in fields._zz ) if ( fields._zz[ has ]( i ) ) {
						found = null
						if ( qt.isF( fields._zz[ i ].func ) ) {
							found = tmp[ i ] = fields._zz[ i ].func.call( ele, fields._zz[ i ], i, m );
						} else if ( qt.isA( fields._zz[ i ].attr ) ) {
							for ( j = 0; j < fields._zz[ i ].attr.length; j++ ) {
								found = qt.is( cssAttr[ fields._zz[ i ].attr[ j ] ] ) ? $( this ).css( fields._zz[ i ].attr[ j ] ) : $( this ).attr( fields._zz[ i ].attr[ j ] );
								if ( qt.is( found ) ) {
									tmp[ i ] = normalize( found, ele, m, fields._zz[ i ].attr[ j ] );
									break;
								}
							}
						}
						if ( found && qt.isF( fields._zz[ i ].filter ) )
							tmp[ i ] = fields._zz[ i ].filter( tmp[ i ] );
					}

					if ( qt.is( fields[ tag ] ) ) for ( i in fields[ tag ] ) if ( fields[ tag ][ has ]( i ) ) {
						found = null
						if ( qt.isF( fields[ tag ][ i ].func ) ) {
							found = tmp[ i ] = fields[ tag ][ i ].func.call( ele, fields[ tag ][ i ], i, m )
						} else if ( qt.isA( fields[ tag ][ i ].attr ) ) {
							for ( j = 0; j < fields[ tag ][ i ].attr.length; j++ ) {
								found = qt.is( cssAttr[ fields[ tag ][ i ].attr[ j ] ] ) ? $( this ).css( fields[ tag ][ i ].attr[ j ] ) : $( this ).attr( fields[ tag ][ i ].attr[ j ] );
								if ( qt.is( found ) ) {
									tmp[ i ] = normalize( found, ele, m, fields[ tag ][ i ].attr[ j ] );
									break;
								}
							}
						}
						if ( found && qt.isF( fields[ tag ][ i ].filter ) )
							tmp[ i ] = fields[ tag ][ i ].filter( tmp[ i ] );
					}

					zones.push( tmp );
				} );

				return zones;
			}

			function _pack_settings_and_zones() {
				var zones = _pack_zones( ui.zones.node ), zzones = _pack_zones( ui.zoom_zones.node );

				$( '#qsot-seating-zones, #qsot-seating-zoom-zones' ).remove();
				var z = $( '<input type="hidden" id="qsot-seating-zones" name="qsot-seating-zones" />' ).val( JSON.stringify( zones ) ).appendTo( 'form#post' );
				var zz = $( '<input type="hidden" id="qsot-seating-zoom-zones" name="qsot-seating-zoom-zones" />' ).val( JSON.stringify( zzones ) ).appendTo( 'form#post' );
				console.log( 'ZONES', JSON.stringify( zones ) );
				console.log( 'ZZONES', JSON.stringify( zzones ) );
				ui.saver.remove_autosave()
			}

			// attach the selection settings box to the ui
			paper.settings_box = new SB( ui );
			QS.cbs.add( 'selection-changed', function() {
				var sel = paper.Selection, sel_cnt = sel.length, data = {}, shared = {}, maybe_shared = {}, atts = {}, tags = {}, tags_cnt = 0, fin = {}, effs = {}, maybe_effs = {}, fin_effs = {}, k = 0, a, val, field;

				for ( a in fields._all ) if ( fields._all[ has ]( a ) ) {
					effs[ a ] = fields._all[ a ];
					shared[ a ] = { values:{}, cnt:0, uniqs:0, multiple:false };
				}

				if ( 0 == sel_cnt ) {
					paper.settings_box.close();
					return;
				}

				for ( i = 0; i < sel_cnt; i++ ) {
					( function( tag, kind, atts, el ) {
						var uniqs = 0, a;

						for ( a in fields._all ) if ( fields._all[ has ]( a ) ) {
							val = atts[ a ] || '';
							if ( qt.isF( fields._all[ a ].filter ) ) val = fields._all[ a ].filter( val );
							if ( qt.is( shared[ a ].values[ val ] ) ) {
								shared[ a ].values[ val ]++;
							} else {
								shared[ a ].uniqs++;
								shared[ a ].values[ val ] = 1;
							}
							if ( shared[ a ].uniqs > 1 ) shared[ a ].multiple = true;
							shared[ a ].cnt++;
						}

						if ( 'zoom-zone' == kind ) for ( a in fields._zz ) if ( fields._zz[ has ]( a ) ) {
							if ( qt.isF( fields._zz[ a ].only_if ) && ! fields._zz[ a ].only_if( el ) ) continue;
							if ( ! qt.is( maybe_effs[ a ] ) ) maybe_effs[ a ] = fields._zz[ a ];
							if ( ! qt.is( maybe_shared[ a ] ) ) maybe_shared[ a ] = { values:{}, uniqs:0, multiple:false };
							field = fields._zz[ a ];

							val = '';
							for ( k = 0; k < field.attr.length; k++ ) {
								if ( ! qt.is( atts[ field.attr[ k ] ] ) ) continue;
								val = atts[ field.attr[ k ] ] || '';
								if ( qt.isF( field.filter ) ) val = field.filter( val );
								break;
							}

							if ( qt.is( maybe_shared[ a ].values[ val ] ) ) maybe_shared[ a ].values[ val ]++;
							else {
								maybe_shared[ a ].uniqs++;
								maybe_shared[ a ].values[ val ] = 1;
							}

							if ( maybe_shared[ a ].uniqs > 1 ) maybe_shared[ a ].multiple = true;
						}

						if ( qt.is( tags[ tag ] ) ) tags[ tag ]++;
						else {
							tags_cnt++;
							tags[ tag ] = 1;
						}

						if ( 1 == tags_cnt && qt.is( fields[ tag ] ) ) {
							for ( a in fields[ tag ] ) if ( fields[ tag ][ has ]( a ) ) {
								if ( qt.isF( fields[ tag ][ a ].only_if ) && ! fields[ tag ][ a ].only_if( el ) ) continue;
								if ( ! qt.is( maybe_effs[ a ] ) ) maybe_effs[ a ] = fields[ tag ][ a ];
								if ( ! qt.is( maybe_shared[ a ] ) ) maybe_shared[ a ] = { values:{}, uniqs:0, multiple:false };
								field = fields[ tag ][ a ];

								val = '';
								for ( k = 0; k < field.attr.length; k++ ) {
									if ( ! qt.is( atts[ field.attr[ k ] ] ) ) continue;
									val = atts[ field.attr[ k ] ] || '';
									if ( qt.isF( field.filter ) ) val = field.filter( val );
									break;
								}

								if ( qt.is( maybe_shared[ a ].values[ val ] ) ) maybe_shared[ a ].values[ val ]++;
								else {
									maybe_shared[ a ].uniqs++;
									maybe_shared[ a ].values[ val ] = 1;
								}

								if ( maybe_shared[ a ].uniqs > 1 ) maybe_shared[ a ].multiple = true;
							}
						} else {
							delete maybe_shared;
							delete maybe_effs;
							maybe_shared = {};
							maybe_effs = {};
						}
					} )( sel.items[ i ].node.tagName.toLowerCase(), sel.items[i].attr( 'kind' ), sel.items[ i ].all_attrs(), sel.items[ i ] );
				}

				$.extend( fin, shared, maybe_shared );
				$.extend( fin_effs, effs, maybe_effs );

				for ( a in fin ) if ( fin[ has ]( a ) ) {
					if ( fin_effs[ a ].hidden ) continue;
					if ( fin_effs[ a ].single && sel_cnt > 1 ) continue;
					if ( fin_effs[ a ].multiple && self_cnt < 2 ) continue;
					data[ a ] = $.extend( {
						onchange: function( $el, attr, field, data, ev ) {
							// if there was an alternate change function passed, then process that. used in some cases
							if ( qt.isF( $el ) ) {
								$el( paper.Selection.items, attr, field, ev );
							} else {
								var all_data = { from:{}, to:{}, type:data.type }, chngd = 0, i = 0, val = 0, id, cur;

								// special case for truefalse values
								if ( 'truefalse' == data.type ) {
									if ( $el.filter( ':checked' ).length ) val = $el.val();
								// all others are straight forward
								} else {
									val = $el.val();
								}

								// update our 'data' for the undoer
								for ( ; i < paper.Selection.length; i++ ) {
									id = paper.Selection.items[ i ].node.snap;
									cur = paper.Selection.items[ i ].attr( attr );
									// if the data actually changed
									if ( cur != val ) {
										//paper.Selection.items[ i ].attr( attr, val + '' );
										if ( ! qt.is( all_data.from[ id ] ) ) all_data.from[ id ] = {};
										if ( ! qt.is( all_data.to[ id ] ) ) all_data.to[ id ] = {};
										all_data.from[ id ][ attr ] = cur;
										all_data.to[ id ][ attr ] = val;
										chngd++;
									}
								}

								if ( chngd > 0 ) ( function( data ) {
									var fn = new S.Undoer.cmd(
												function() {
													var i, el;
													for ( i in this.data.from ) if ( this.data.from[ has ]( i ) && this.data.to[ has ]( i ) ) {
														el = S.str4ele( i );
														if ( qt.isO( el ) )
															el.attr( this.data.to[ i ] );
													}
												},
												function() {
													var i, el;
													for ( i in this.data.to ) if ( this.data.to[ has ]( i ) ) {
														el = S.str4ele( i );
														if ( qt.isO( el ) )
															el.attr( this.data.from[ i ] );
													}
												},
												$.extend( true, {}, data )
											),
											last = ui.canvas.U.get( 1 );
									if ( qt.is( last ) &&  'colorpicker' == last.data.type ) {
										fn.data.from = last.data.from;
										ui.canvas.U.replace( fn, 1, false );
									} else {
										ui.canvas.U.add( fn, false );
									}
								} )( all_data );
							}
							QS.cbs.trigger( 'selection-move-end' );
						},
						type:'text', name:a, attr:[], matrix:'', min:'', max:'', step:'', single:false, multiple:false
					}, fin_effs[ a ], { values:fin[ a ].values, has_multiple:fin[ a ].multiple, cnt:fin[ a ].cnt, value:( fin[ a ].multiple ) ? '' : ( Object.keys( fin[ a ].values )[0] || '' ) } );
				}

				paper.settings_box.set_data( data ).open();
			} );

			// create a set associated to a specific paper, which contains a list of all selected elements
			var sel = paper.Selection = S.set(), copied = S.set(), buffer_protect = 0, bp_delay = 300;
			sel.paper = paper;

			// delete selection
			_on_keydown( '~8 ~46', function( ev ) {
				ev.preventDefault();
				var els = sel.clear(), i = 0, ii = els.length;
				for ( ; i < ii; i++ ) {
					els[ i ].remove();
					delete els[ i ];
				}
				QS.cbs.trigger( 'deleted-elements' );
			}, paper.id + '-del' );

			// copy selection
			_on_keydown( 'c67', function( ev ) {
				if ( ! sel.length ) return;
				copied.clear();
				sel.forEach( function( item ) { copied.push( item ); } );
			}, paper.id + '-copy' );

			var buffer_protect = 0;
			// paste selection. delay of 500ms after first paste
			_on_keydown( 'c86', function( ev ) {
				// protection to prevent super pasting. delays next paste to 500ms of key holding
				var now = ( new Date ).getTime();
				if ( buffer_protect > now - bp_delay ) return;
				buffer_protect = now;

				// if there is nothing to paste, then skip this
				if ( ! copied.length ) return;

				( function( items ) {
					paper.U.add( new S.Undoer.cmd(
						function() {
							var m = ( new S.Matrix ).translate( cp_dist, cp_dist ), i = 0, ii = items.length;

							for ( ; i < ii; i++ ) {
								var item = items[ i ], n = ( item.matrix || new S.Matrix ), t = m.clone().add( n );
								this.data.cps[ this.data.cps.length ] = item.clone().appendTo( item.parent() ).transform( t );
								copied.splice( i, 1, this.data.cps[ this.data.cps.length - 1] );
							};

							sel.set.apply( sel, this.data.cps );
						},
						function() {
							while ( this.data.cps.length > 1 ) this.data.cps.pop().remove();
						},
						{ cps:[ true ] }
					) );
				} )( copied.items );
			}, paper.id + '-paste' );

			// arrow key bumping
			var dirs = {
						'37': [ -1, 0 ],
						'38': [ 0, -1 ],
						'39': [ 1 , 0 ],
						'40': [ 0, 1 ]
					},
					shift = 10,
					normal = 1;
			// on any arrow key, bump the selection in the direction hit.
			// shift + arrow = jump 10 (or the value of shift above)
			// alt + arrow = make a copy in the given direction. if shift is also hit, the copy is placed 'shift' pixels away
			_on_keydown( '~37 ~38 ~39 ~40', function( ev ) {
				ev.preventDefault();
				var dir = qt.is( dirs[ ev.which ] ) ? dirs[ ev.which ] : false, amplitude = { x:ui.canvas.zoom.to_scale( normal ), y:ui.canvas.zoom.to_scale( normal ) };
				if ( ! dir || ! sel.length ) return;

				if ( ev.ctrlKey || ev.metaKey ) {
					var sbb = sel.getBBox();
					amplitude = { x:sbb.width, y:sbb.height };
				} else if ( ev.shiftKey ) {
					amplitude = { x:ui.canvas.zoom.to_scale( shift ), y:ui.canvas.zoom.to_scale( shift ) };
				}

				var move = [ dir[0] * amplitude.x, dir[1] * amplitude.y ];

				// if we are 'copying' then run some code on each selected item to copy it in the given direction
				if ( ev.altKey ) {
					var m = ( new S.Matrix ).translate( move[0], move[1] ), ids = [];
					sel.forEach( function( item ) { ids[ ids.length ] = item.attr( 'id' ); } );
					( function( ids, m ) {
						paper.U.add( new S.Undoer.cmd(
							function() {
								var m = ( new S.Matrix ).translate( cp_dist, cp_dist ), i = 0, ii = ids.length;

								for ( ; i < ii; i++ ) {
									var item = S.node4ele( $( '#' + ids[ i ], paper.node ).get( 0 ) ), n = ( item.matrix || new S.Matrix ), t = this.data.m.clone().add( n );
									this.data.obj_ids[ i ] = this.data.obj_ids[ i ] || fix_id_field();
									this.data.cps[ this.data.cps.length ] = item.clone().attr( { id:this.data.obj_ids[ i ] } ).appendTo( item.parent() ).transform( t );
								};

								sel.set.apply( sel, this.data.cps );
							},
							function() {
								while ( this.data.cps.length > 1 ) this.data.cps.pop().remove();
							},
							{ cps:[ true ], obj_ids:[], m:m }
						) );
					} )( ids, m );
				// if we are just bumping, then simply translate each selected item
				} else {
					sel.forEach( function( item, i ) {
						if ( qt.toInt( item.attr( 'locked' ) ) > 0 ) return;
						var m = ( item.matrix || new S.Matrix ).translate( move[0], move[1] );
						item.transform( m );
					} );
				}

				// trigger selection event
				QS.cbs.trigger( 'selection-move-end', [ sel ] );
			}, paper.id + '-arrows' );

			sel.enabled = true;
			sel.suppress = false;
			sel.mode = 'multiple';
			sel.context = ui.zones;

			sel.set_mode = function( mode ) {
				if ( $.inArray( mode, [ 'single', 'multiple' ] ) > -1 )
					sel.mode = mode;
				return sel;
			}

			sel.set_context = function( el ) {
				sel.context = el;
				return sel;
			}

			sel.get_context = function() {
				return sel.context;
			}

			sel.get_all = function() {
				var s = S.set();
				this.forEach( function( obj, i ) { s.push( obj ); }, s );
				return s;
			}

			sel.enable = function() { sel.enabled = true; return sel; }
			sel.disable = function() { sel.enabled = false; return sel; }
			sel.is_enabled = function() { return sel.enabled; }

			// fastest way to bbox the set is to throw copies into a group and bbox the group. we dont want the actual elements in a group, beucase they will lose their dom position if they are
			sel.getBBox = function() {
				var bbox = { x:0, y:0, width:0, height:0 };
				if ( ! this.length ) return bbox;

				var p = paper.g(), i = 0;
				for ( ; i < this.length; i++ )
					p.append( this[ i ].node.cloneNode(true) );
				bbox = p.getBBox();
				p.remove();
				return bbox;
			};

			sel.at = function( i ) {
				return ( i >= 0 && i < this.items.length ) ? this.items[ i ] : undefined;
			};

			sel.within = function( bounds, action ) {
				var osup = this.suppress;
				this.suppress = true;
				var action = action || 'set', els = [], nodes = [], i;
				if ( ! qt.isN( bounds.x ) || ! qt.isN( bounds.y ) || ! qt.isN( bounds.width ) || ! qt.isN( bounds.height ) ) return this;
				bnds = paper.node.createSVGRect();
				$.extend( bnds, bounds );
				nodes = paper.node.getIntersectionList( bnds, sel.context.node );

				if ( nodes.length ) {
					for ( i = 0; i < nodes.length; i++ ) {
						var el = S.node4ele( nodes[ i ] );
						if ( el.hasClass( 'DA' ) && qt.toInt( el.attr( 'locked' ) ) == 0 ) els[ els.length ] = el;
					}
				}
				
				if ( 'add' == action ) this.push.apply( this, els );
				else if ( 'remove' == action ) this.exclude.apply( this, els );
				else this.set.apply( this, els );

				this.suppress = osup;
				
				QS.cbs.trigger( 'selection-changed', [ this, els, 'within' ] )
				return this;
			};

			sel.set = function( skip_cls_correct ) {
				var osup = this.suppress;
				this.suppress = true;
				var ind = 0, skip = false, i;
				if ( qt.isB( skip_cls_correct ) ) {
					skip = skip_cls_correct;
					ind = 1;
				}
				
				var res = this.clear(), items = [].slice.call( arguments, ind );

				if ( skip ) {
					for ( i = 0; i < items.length; i++ )
						this[ this.items.length ] = this.items[ this.items.length ] = items[ i ];
					this.length = this.items.length;
				} else {
					this.push.apply( this, items );
				}

				this.suppress = osup;

				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, res, 'splice' ] )

				return this;
			};

			sel.contains = function( el ) {
				var found = false, i, ii;
				for ( i = 0, ii = this.items.length; i < ii; i++ )
					if ( el.id == this.items[ i ].id ) {
						found = true;
						break;
					}
				return found;
			}

			sel.push = function() {
				var i = 0, ii = arguments.length;
				for ( ; i < ii; i++ ) {
					if ( arguments[ i ].hasClass( 'DA' ) ) {
						this.items[ this.length ] = this[ this.length ] = arguments[ i ].addClass( 'SLD' );
						this.length++;
					}
				}

				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, [].slice.call( arguments ), 'push' ] )
				return this;
			};

			var exclude = sel.exclude;
			sel.exclude = function() {
				var rids = {}, res = [], items = [], i = 0, ii = arguments.length;
				if ( ! ii ) return;

				while ( this.length && delete this[ this.length-- ] );
				for ( ; i < ii; i++ ) rids[ arguments[ i ].id ] = 1;

				for ( i = 0; i < this.items.length; i++ )
					if ( ! qt.is( rids[ this.items[ i ].id ] ) )
						this[ items.length ] = items[ items.length ] = this.items[ i ];
					else
						res[ res.length ] = this.items[ i ].removeClass( 'SLD' );
				this.items = items;
				this.length = this.items.length;

				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, res, 'exclude' ] )
				return this;
			};

			var pop = sel.pop;
			sel.pop = function() {
				this.length && delete this[ this.length-- ];
				var res = this.items.pop();
				if ( qt.isO( res ) ) res.removeClass( 'SLD' );

				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, res, 'pop' ] )
				return res;
			};

			var insertAfter = sel.insertAfter;
			sel.insertAfter = function( el ) {
				el.addClass( 'SLD' );
				var res = insertAfter.apply( this, [].slice.call( arguments, 0 ) );

				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, res, 'insertAfter' ] )
				return res;
			};

			sel.clear = function() {
				var res = this.items;
				while ( this.length && delete this[ this.length-- ] )
					this.items[ this.length ].removeClass( 'SLD' );
				this.items = [];
				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, res, 'clear' ] )
				return res;
			};

			var splice = sel.splice;
			sel.splice = function( index, count, insertion ) {
				for ( var i = index; i < index + count; i++ )
					this.items[ i ].removeClass( 'SLD' );
				for ( var i = 2; i < arguments.length; i++ )
					if ( qt.is( arguments[ i ] ) )
						arguments[ i ].addClass( 'SLD' );
				var res = splice.apply( this, [].slice.call( arguments, 0 ) );

				if ( ! this.suppress )
					QS.cbs.trigger( 'selection-changed', [ this, res, 'splice' ] )
				return res;
			};


			// attach the shape clicks to the actual draw surface canvas, not every canvas
			var s = { x:0, y:0, on:false };
			$( ui.shp.node )
				.off( 'mousedown.qs-select', '.DA' ).on( 'mousedown.qs-select', '.DA', function( ev ) {
					if ( ev.which != 1 ) return;
					s.x = ev.pageX;
					s.y = ev.pageY;
					s.on = this;
				} )
				.off( 'click.qs-select', '.DA' ).on( 'click.qs-select', '.DA', function( ev ) {
					if ( ev.which == 1 ) {
						if ( Math.abs( ev.pageX - s.x ) > click_thresh || Math.abs( ev.pageY - s.y ) > click_thresh ) return;
						var ele = $( this ), sld = ele.hasClass( 'SLD' ), da = ele.hasClass( 'DA' );
						if ( ! da ) return;

						if ( 'multiple' == sel.mode && ( ev.shiftKey || ev.ctrlKey || ev.metaKey ) ) {
							paper.Selection[ sld ? 'exclude' : 'push' ]( S.node4ele( this ) );
						} else {
							var cnt = paper.Selection.length;
							paper.Selection.clear();
							if ( ! sld || cnt > 1 ) paper.Selection.push( S.node4ele( this ) );
						}
					}
				} )
				.off( 'contextmenu.qs-select', '.DA' ).on( 'contextmenu', '.DA', function( ev ) {
					var ele = S.node4ele( this );
					ev.preventDefault();
					ui.right_menu.show( 'shape-actions', function() { return ele.hasClass( 'SLD' ) ? S.set.apply( S.set, ui.canvas.Selection.items ) : S.set( ele ); }, ev.clientX, ev.clientY );
				} );
		} )( 10 );

		QS.cbs.add( 'right-menu-register', function( rm ) {
			rm.register( 'shape-actions', [ {
				label: 'Send to Back',
				run: function( get_eles ) {
					var eles = get_eles();
					eles.forEach( function( item ) {
						item.prependTo( item.parent() );
					} );
				}
			}, {
				label: 'Bring to Front',
				run: function( get_eles ) {
					var eles = get_eles();
					eles.forEach( function( item ) {
						item.appendTo( item.parent() );
					} );
				}
			} ] );
		} );

		// add a marquee button to select based on drawing a box
		QS.cbs.add( 'create-btns', function( t ) {
			var marquee = t.tool.g().hide(), //.attr( 'visibility', 'hidden' ),
					sel = t.canvas.Selection,
					mwhite = t.tool.rect( 0, 0, 1, 1 ).attr( { fill:'transparent', stroke:'#fff', 'stroke-width':1 } ).appendTo( marquee ),
					mblack = t.tool.rect( 0, 0, 1, 1 ).attr( { fill:'transparent', stroke:'#000', 'stroke-width':1, 'stroke-dasharray':[ 3, 3 ] } ).appendTo( marquee ),
					mevents = [],
					start = { x:0, y:0 },
					desc = { x:0, y:0, width:0, height:0 };

			marquee.down = false;

			marquee.move_to = function( x, y ) {
				var m = ( new S.Matrix ).translate( x, y );
				marquee.transform( m );
				return this;
			};

			marquee.resize_to = function( w, h ) {
				mwhite.attr( { width:w, height:h } );
				mblack.attr( { width:w, height:h } );
				return this;
			};

			function _mousedown( e, x, y ) {
				e.stopPropagation();
				start.x = x;
				start.y = y;
				desc.adj = t.pos( desc.x, desc.y );
				marquee.move_to( desc.adj.x, desc.adj.y ).resize_to( desc.width, desc.height ).show();
			}

			function _mouseup( e, x, y ) {
				e.stopPropagation();
				if ( ! svgrect_relative )
					$.extend( desc, desc.adj );
				sel.within( desc, e.shiftKey || e.ctrlKey || e.metaKey ? 'add' : 'set' );
				desc = { x:0, y:0, width:1, height:1 };
				marquee.hide().move_to( desc.x, desc.y ).resize_to( desc.width, desc.height );
			}

			function _mousemove( e, x, y ) {
				e.stopPropagation();
				desc = {
					x: Math.min( start.x, x ),
					y: Math.min( start.y, y ),
					width: Math.abs( start.x - x ),
					height: Math.abs( start.y - y )
				};
				desc.adj = t.pos( desc.x, desc.y );
				marquee.move_to( desc.adj.x, desc.adj.y ).resize_to( desc.width, desc.height );
			}

			function _start_marquee() {
				t.e.canvas.on( 'mousedown.marquee', function( e ) { if ( ! sel.is_enabled() ) return; marquee.down = true; _mousedown.call( this, e, e.pageX, e.pageY ); } );
				$( window ).on( 'mouseup.marquee', function( e ) { if ( ! sel.is_enabled() ) return; if ( marquee.down ) { marquee.down = false; _mouseup.call( this, e, e.pageX, e.pageY ); } } );
				$( window ).on( 'mousemove.marquee', function( e ) { if ( ! sel.is_enabled() ) return; if ( marquee.down ) _mousemove.call( this, e, e.pageX, e.pageY ); } );
			}

			function _end_marquee() {
				t.e.canvas.off( '.marquee' );
				$( window ).off( '.marquee' );
			}

			t.toolbar.add_btn( {
				ele: t.toolbar.hud.rect( 0, 0, 20, 20 ).attr( { style:'fill:transparent; stroke-dasharray:2, 2;' } ),
				name: 'marquee',
				title: 'Mass Selection (Marquee Tool)',
				start_active: _start_marquee,
				end_active: _end_marquee
			} );
		} )( -1 );
	} );

	// color picker. controls the fill color of the next drawn objects
	S.plugin( function( S, E, P, G, F ) {
		function color_picker( ui, paper ) {
			this.ui = ui;
			this.p = paper;
			this.color = Color( '#000' );
			this.btn = false;
		}

		function one2hex( v ) { return ( '0' + qt.toInt( v ).toString( 16 ) ).substr( -2 ); }
		function rgb2hex( v ) { return '#' + one2hex( v.r ) + one2hex( v.g ) + one2hex( v.b ); }

		var cproto = {};

		cproto.HEX = 'hex';
		cproto.RGB = 'rgb';
		cproto.HSL = 'hsl';
		cproto.HSV = 'hsv';

		cproto.get = function( frmt ) {
			var frmt = frmt || 'hex';
			switch ( frmt ) {
				case this.RGB: return this.color.toRGB(); break;
				case this.HSL: return this.color.toHSL(); break;
				case this.HSV: return this.color.toHSV(); break;
				default:
				case this.HEX: return this.color.toString(); break;
			}
		};

		cproto.set = function( clr ) {
			if ( qt.isS( clr ) ) this.color = Color( clr );
			else if ( qt.isA( clr ) ) this.color = Color( clr );
			else if ( qt.isO( clr ) ) {
				if ( clr[ has ]( 'r' ) && clr[ has ]( 'g' ) && clr[ has ]( 'b' ) ) this.color = Color( [ clr.r, clr.g, clr.b ] );
				else if ( clr[ has ]( 'value' ) && clr[ has ]( 'saturation' ) && clr[ has ]( 'hue' ) ) this.color = Color( clr );
				else if ( clr[ has ]( 'lightness' ) && clr[ has ]( 'saturation' ) && clr[ has ]( 'hue' ) ) this.color = Color( clr );
				else if ( clr[ has ]( 'v' ) && clr[ has ]( 's' ) && clr[ has ]( 'h' ) ) this.color = Color( { hue:clr.h, saturation:clr.s, value:clr.v } );
				else if ( clr[ has ]( 'l' ) && clr[ has ]( 's' ) && clr[ has ]( 'h' ) ) this.color = Color( { hue:clr.h, saturation:clr.s, lightness:clr.l } );
			}
			if ( qt.isO( this.btn ) ) {
				this.btn.icon.attr( { fill:this.color.toString() } );
			}
		};

		color_picker.prototype = cproto;

		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			paper.CP = new color_picker( ui, paper );
		} )( 10 );

		QS.cbs.add( 'create-btns', function( t ) {
			t.toolbar.add_btn( {
				ele: t.toolbar.hud.rect( 0, 0, 31, 31 ),
				init: function() {
					var me = this;

					me.icon.removeClass( 'icon' );

					function _close() { me._cp_shell.trigger( 'close' ); }

					me._cp_shell = $( '<div class="cp-shell"></div>' ).appendTo( 'body' ).iris( {
						color: { h:0, s:100, v:0 },
						width: 300,
						mode: 'hsv',
						change: function( ev, ui ) { t.canvas.CP.set( ui.color.toString() ); },
						clear: function( ev, ui ) { t.canvas.CP.set( 'transparent' ); }
					} ).on( {
						'close.cp': function() {
							$( this ).removeClass( 'open' );
							me._cp_shell_close.hide();
							me._cp_shell.iris( 'hide' );
							_off_keydown( '~27 ~13', 'color-pick' );
							$( window ).off( 'click.cp' );
						},
						'open.cp': function() {
							$( this ).addClass( 'open' );
							var s = $( me.shell.node ), pos = s.offset(), bbox = me.shell.getBBox();
							me._cp_shell_close.show();
							me._cp_shell.css( { top:pos.top, left:pos.left + bbox.width } ).iris( 'show' );
							_on_keydown( '~27 ~13', _close, 'color-pick' );
							$( window ).on( 'click.cp', _close );
						},
						'toggle.cp': function( ev ) {
							if ( $( this ).hasClass( 'open' ) ) {
								$( this ).trigger( 'close' );
							} else {
								$( this ).trigger( 'open' );
							}
						}
					} );

					// fix chrome's dumb click send after drag on the slider control
					me._cp_shell.find( '.iris-picker' ).on( 'click', function( ev ) { ev.stopPropagation(); } );

					me._cp_shell_close = $( '<div class="cp-shell-close">X</div>' ).appendTo( me._cp_shell ).click( function() { me._cp_shell.trigger( 'close' ); } )

					t.canvas.CP.btn = me;
					t.canvas.CP.set( t.canvas.CP.get() );
				},
				only_click: true,
				name: 'color',
				title: 'Fill Color',
				click: function( btn, ev ) { ev.stopPropagation(); btn._cp_shell.trigger( 'toggle' ) }
			} );
		} )( 0 );
	} );

	function bound( x, y, ele, container, outside ) {
		var ele = $( ele ),
				container = $( container ),
				inside = outside || false,
				my_dim = { x:ele.width(), y:ele.height() },
				cont_dim = { x:container.width(), y:container.height() },
				cont_off = ( outside ) ? { left:0, top:0 } : container.offset(),
				cxy = {
					x: Math.min( cont_dim.x - my_dim.x, Math.max( 0, x - cont_off.left ) ),
					y: Math.min( cont_dim.y - my_dim.y, Math.max( 0, y - cont_off.top ) )
				};
		return { left:cxy.x + cont_off.left, top:cxy.y + cont_off.top };
	}

	var button_bars = {}, bbar_ind = 1;
	QS.Buttonbar = ( function() {
		var defs = {
			max_height:444
		};

		function _allow_drag( ele, opts ) {
			var opts = $.extend( {
						by: false,
						inside: false,
						snap: false,
						snap_tolerance: 15,
						with_pos: function( pos ) { return pos; }
					}, opts ),
					start_off = { x:0, y:0 },
					w = $( window ),
					ele = $( ele ),
					adjust = function( x, y ) {
						var res = { left:x, top:y };
						if ( ! opts.inside ) return res;
						var off = $( opts.inside ).offset();
						res = { left:x - off.left, y:y - off.top };
						return res;
					},
					confine = function( x, y, allow_snap ) {
						var res = { left:x - start_off.x, top:y - start_off.y, snap:[] }, allow_snap = allow_snap || false;;
						if ( ! opts.inside ) return res;
						var inside = $( opts.inside ), off = inside.offset(), dims = { x:inside.width(), y:inside.height() }, my_dims = { x:ele.width(), y:ele.height() };
						res = { left:Math.max( 0, res.left - off.left ), top:Math.max( 0, res.top - off.top ), snap:res.snap };
						res = { left:Math.min( dims.x - my_dims.x, res.left ), top:Math.min( dims.y - my_dims.y, res.top ), snap:res.snap };
						if ( opts.snap && allow_snap ) {
							if ( res.left < opts.snap_tolerance ) { res.left = 0; res.snap.push( 'left' ); }
							else if ( res.left > dims.x - my_dims.x - opts.snap_tolerance ) { res.left = 'auto'; res.right = 0; res.snap.push( 'right' ); }
							if ( res.top < opts.snap_tolerance ) { res.top = 0; res.snap.push( 'top' ); }
							else if ( res.top > dims.y - my_dims.y - opts.snap_tolerance ) { res.top = 'auto'; res.bottom = 0; res.snap.push( 'bottom' ); }
						}
						return res;
					},
					down = false;

			ele.on( 'mousedown.hud-drag', function( e ) {
				if ( opts.by )
					if ( ! $( e.target ).is( opts.by ) )
						return;
				down = true;
				var e_off = ele.offset();
				start_off.x = e.pageX - e_off.left;
				start_off.y = e.pageY - e_off.top;
			} );

			w.on( 'mousemove.hud-drag', function( e ) {
				if ( ! down ) return;
				var pos = opts.with_pos( confine( e.pageX, e.pageY, ( ! e.ctrlKey && ! e.metaKey ) ) ), snap = pos.snap;
				delete pos.snap;
				ele.css( $.extend( { right:'auto', bottom:'auto' }, pos ) );
				ele.data( 'cur-pos', { snap:snap || [], x:( 'auto' == pos.left ) ? pos.right : pos.left, y:( 'auto' == pos.top ) ? pos.bottom : pos.top } );
			} );

			w.on( 'mouseup.hud-drag', function( e ) {
				if ( ! down ) return;
				down = false;
			} );
		}

		function btnbar( cmd ) {
			var t = this,
					p = t.tray_props || {},
					g = t.tray_group || false,
					hud = qt.is( t.hud ) ? t.hud : false,
					args = [].slice.call( arguments, 1 );
			t.e = t.e || {};
			t.btns = t.btns || [];
			t.o = $.extend( {}, defs, t.o );
			t.tray_props = p;
			t.tray_group = g;

			function parse_request() {
				if ( qt.isS( cmd ) && qt.isF( t[ cmd ] ) ) {
					return t[ cmd ].apply( t, args );
				} else if ( ( ( qt.isS( cmd ) && qt.is( p[ cmd ] ) ) || ( qt.isO( cmd ) && ! qt.isC( cmd, QS.SeatingUI ) ) ) ) {
					args.unshift( cmd );
					return _update_p.apply( t, args );
				} else if ( qt.isC( cmd, QS.SeatingUI ) || qt.isC( t.ui, QS.SeatingUI ) ) {
					_update_p.apply( t, args );
					t.ui = cmd;
					var off = t.ui.e.main.offset();
					t.e.hud = $( '<svg id="' + p.id + '" class="' + ( qt.isA( p.cls ) ? p.cls.join( ' ' ) : p.cls ) + '"></svg>' ).appendTo( t.ui.e.main );
					_allow_drag( t.e.hud, {
						by: '.ui-hndl',
						inside: t.ui.e.main,
						snap: true
					} );
					t.hud = _new_paper( t.e.hud.get( 0 ) );
					hud = t.hud;
					return t.reinit.apply( t, args );
				} else {
					throw "No SNAPSVG canvas specified. Buttonbar cannot initialize.";
				}

				return t;
			}

			t.reinit = function( opts ) {
				_setup_elements( opts );
				button_bars[ p.id ] = t;
				return this;
			}

			t.add_btn = function( btns ) {
				if ( typeof btns == 'object' ) {
					if ( btns.constructor == Array ) {
						for ( i in btns ) _add_btn( btns[ i ] );
					} else {
						_add_btn( btns );
					}
					_render_btns()
					_redraw_tray();
				}
				return this;
			}

			t.activate = function( name ) {
				var btn,
						i,
						ii;

				for ( i = 0, ii = this.btns.length; i < ii; i++ ) {
					if ( this.btns[ i ].name == name ) {
						btn = this.btns[ i ];
						break;
					}
				}

				btn && _make_active( btn );
			}

			function _update_p( pairs, value ) {
				if ( qt.isS( pairs ) ) {
					if ( qt.is( value ) ) {
						var key = pairs;
						pairs = {};
						pairs[ key ] = value;
					} else {
						return p[ pairs ];
					}
				}

				p = $.extend( true, {
					id: 'qsot-hud-' + ( bbar_ind++ ),
					cls: 'hud',
					x: 0,
					y: 30,
					snap: 'top left',
					rows: 1,
					cols: 1,
					orientation: 'vertical',
					bg_color: '#ddd',
					brdr_color: '#555',
					brdr_width: 1,
					hndl: {
						vertical: {
							height: 10,
							width: 32
						},
						horizontal: {
							height: 32,
							width: 10
						}
					},
					btn: {
						height: 32,
						width: 32,
						space_x: 2,
						space_y: 2
					}
				}, p, pairs );

				p.orientation = ( [ 'vertical', 'horizontal' ].indexOf( p.orientation ) > -1 ) ? p.orientation : 'vertical'
			}

			function _setup_elements( opts ) {
				_update_p( opts )
				var m = ( new S.Matrix ).translate( 0, p.hndl[ p.orientation ].height );
				t.e.tray_bg = hud.rect( 0, 0, 1, 1 ).attr( { fill:'#ddd' } ).transform( m );
				t.e.tray_brdr = hud.polygon( [ 0, 0, 10, 10 ] ).transform( m );
				t.e.handle = hud.g().addClass( 'ui-hndl' );
				hud.rect( 0, 0, p.hndl[ p.orientation ].width + ( 2 * p.btn.space_x ) - 1, p.hndl[ p.orientation ].height ).attr( { fill:'#ddd', stroke:'#555' } ).addClass( 'ui-hndl' ).appendTo( t.e.handle );
				for ( var i = 2; i < p.hndl[ p.orientation ].height - 1; i = i + 2 )
					hud.line( p.btn.space_x - 1, i, p.hndl[ p.orientation ].width + p.btn.space_x, i ).attr( { stroke:'#555' } ).addClass( 'ui-hndl' ).appendTo( t.e.handle );
				g = hud.g( t.e.tray_bg, t.e.tray_brdr );
				t.ui.tooltip.attachTo( '.ui-btn', {}, hud.node );
				_redraw_tray();
			}

			function _calc_tray_props() {
				var total_height = ( t.btns.length * ( p.btn.height + p.btn.space_y ) ) + ( 2 * p.brdr_width ) + p.btn.space_y,
						max_rows = Math.floor( t.o.max_height / ( p.btn.height + p.btn.space_y ) ),
						cols = Math.ceil( t.btns.length / max_rows ),
						rows = ( total_height > t.o.max_height ) ? max_rows : Math.floor( total_height / ( p.btn.height + p.btn.space_y ) );
				p.cols = cols;
				p.rows = rows;
			}

			function _redraw_tray() {
				_calc_tray_props();
				var w = ( p.cols * ( p.btn.width + p.btn.space_x ) ) + p.btn.space_x - 1,
						h = ( p.rows * ( p.btn.height + p.btn.space_y ) ) + p.btn.space_y - 1;
				t.e.tray_bg.attr( { width:w, height:h, x:0, y:0 } );
				t.e.hud.css( { width:w, height:h + p.hndl[ p.orientation ].height } );
				t.e.tray_brdr.attr( {
					stroke: p.brdr_color,
					'stroke-width': p.brdr_width,
					fill: 'transparent',
					points: [ 0, 0, w, 0, w, h, 0, h ]
				} );
				if ( ! t.e.hud.data( 'cur-pos' ) )
					t.e.hud.data( 'cur-pos', { snap:p.snap, x:p.x, y:p.y } );
				_adjust_position();
			}

			t.redraw = _redraw_tray;

			function _adjust_position() {
				t.e.hud.css( { top:'auto', left:'auto', bottom:'auto', right:'auto', margin:'auto', marginTop:'auto', marginLeft:'auto' } );
				var q = $.extend( {}, p, t.e.hud.data( 'cur-pos' ) ), loc = { tb:'top', lr:'left', tbm:false, lrm:false }, dims = { x:t.e.hud.width(), y:t.e.hud.height() },
						snaps = qt.isA( q.snap ) ? q.snap.slice( 0 ) : q.snap.split( /\s+/ ), snaps = snaps.filter( function( v ) { return !!v; } ), ex = 0, ey = 0, i;
				for ( i = 0; i < snaps.length; i++ ) {
					if ( 'top' == snaps[ i ] || 'bottom' == snaps[ i ] ) {
						loc.tb = snaps[ i ];
						loc.tbm = true;
					} else if ( 'left' == snaps[ i ] || 'right' == snaps[ i ] ) {
						loc.lr = snaps[ i ];
						loc.lrm = true;
					} else if ( 'center' == snaps[ i ] ) {
						if ( 1 == snaps.length ) {
							loc.tb = loc.lr = snaps[ i ];
							loc.tbm = loc.lrm = true;
						} else if ( ! loc.tbm ) {
							loc.tb = snaps[ i ];
							loc.tbm = true;
						} else if ( ! loc.lrm ) {
							loc.lr = snaps[ i ];
							loc.lrm = true;
						}
					}
				}

				var css = {}, xy = ( snaps.length ) ? { x:q.x, y:q.y } : t.ui.canvas.DF.xy4mode( q.x, q.y ), lt;
				if ( ! snaps.length ) {
					lt = bound( xy.x, xy.y, t.e.hud, t.ui.e.main, true );
					xy = { x:lt.left, y:lt.top };
				}
				if ( 'center' != loc.tb ) css[ loc.tb ] = xy.y;
				else css[ 'margin-top' ] = q.y;
				if ( 'center' != loc.lr ) css[ loc.lr ] = xy.x;
				else css[ 'margin-left' ] = q.y;

				t.e.hud.css( css );
			}

			function _render_btns() {
				_redraw_tray();
				for ( var i = 0; i < t.btns.length; i++ ) {
					var pos_top = ( ( i % p.rows ) * ( p.btn.height + p.btn.space_y ) ) + p.btn.space_y,
							pos_left = ( Math.floor( i / p.rows ) * ( p.btn.width + p.btn.space_x ) ) + p.btn.space_x;
					var m = new S.Matrix();
					m.translate( pos_left, pos_top + p.hndl[ p.orientation ].height );
					t.btns[ i ].ele.transform( m );
				}
			}

			function _make_active( btn ) {
				if ( ! btn.only_click ) {
					var l, bb;
					for ( l in button_bars ) if ( button_bars[ has ]( l ) ) {
						bb = button_bars[ l ];
						for ( var i = 0; i < bb.btns.length; i++ ) {
							if ( bb.btns[ i ].ele.hasClass( 'active' ) && bb.btns[ i ].name != btn.name ) {
								bb.btns[ i ].ele.removeClass( 'active' );
								bb.btns[ i ].end_active( bb );
							}
						}
					}

					if ( ! btn.ele.hasClass( 'active' ) ) {
						btn.ele.addClass( 'active' );
						btn.start_active( t );
					}
				}
			}

			function _add_btn( btn ) {
				t.bcnt = t.bcnt || 0;
				var btn = $.extend( {
					only_click: false,
					init:function(){},
					ele: false,
					name: 'btn-' + ( ++t.bcnt ),
					title: 'Button ' + t.bcnt,
					start_active: function() {},
					end_active: function() {}
				}, btn );

				if ( qt.isO( btn.ele ) ) {
					var wrap = hud.rect( 0, 0, p.btn.width - 1, p.btn.height - 1 ).addClass( 'shell' ),
							bb = btn.ele.attr( { x:0, y:0 } ).getBBox(),
							wbb = wrap.attr( { x:0, y:0 } ).getBBox();
					btn.shell = wrap;
					btn.icon = btn.ele.addClass( 'icon' ).after( wrap ).transform( ( new S.Matrix() ).translate( wbb.cx - bb.cx, wbb.cy - bb.cy ) );
					btn.ele = hud.g( wrap, btn.ele ).data( { item:btn } ).addClass( 'ui-btn' ).click( function() { _make_active( btn ); } );
					$( btn.ele.node ).data( { tooltip:btn.title } );
					// pretty dumb, but no title anything creates a tooltip in chrome.... super bug, but they refuse to fix it. seems stupid but may have to goto a javascript based solution for this.
					//$( '<title>' + btn.title + '</title>' ).prependTo( btn.ele.node );

					for ( i = 0; i < event_names.length; i++ ) {
						if ( ! qt.isF( btn[ event_names[ i ] ] ) ) continue;
						( function() {
							var func = btn[ event_names[ i ] ];
							btn.ele[ event_names[ i ] ]( function() {
								var args = [].slice.call( arguments, 0 ),
										type = args[0].type;
								args.unshift( btn );
								func.apply( this, args );
							} );
						} )();
					}

					if ( qt.isA( btn.hover ) ) {
						btn.ele.hover.apply( btn.ele, btn.hover );
					}

					if ( qt.isA( btn.drag ) ) {
						btn.ele.drag.apply( btn.ele, btn.drag );
					}

					btn.init.call( btn );

					g.add( btn.ele );
					t.btns.push( btn );
				}
			}

			return parse_request();
		}

		return btnbar;
	} )();

	QS.SeatingUI = ( function() {
		var defs = {
					container: '[rel="qsot-scui"]'
				},
				canvas_settings = {},
				next_id = 1;

		function ui( o ) {
			var t = this,
					args = [].slice.call( arguments, 1 ),
					prev_context = false,
					mode = 'draw';
			t.initialized = t.initialized || false;
			t.e = t.e || {};
			t.o = t.o || {};
			t.n = t.n || {};
			
			function parse_request() {
				if ( qt.isS( o ) && qt.isF( t[ o ] ) ) {
					t[ o ].apply( t, args );
				} else if ( qt.isS( o ) && qt.isS( args[0] ) ) {
					args.unshift( o );
					t.set_options.apply( t, args );
				} else if ( qt.isO( o ) ) {
					t.set_options.apply( t, [ o ] )
					t.reinit( t, args );
				} else {
					t.set_options.apply( t, [] )
					t.reinit().apply( t, args );
				}
			}

			t['reinit'] = function ( force ) {
				var force = force || false;
				if ( ! force && t.initialized ) return;
				initialized = true;
				
				_setup_elements();
				_setup_events();
				_reinit_ui();
			}

			t['pos'] = function( x, y ) {
				return {
					x: x - 1 - t.canvas_off['left'],
					y: y - 1 - t.canvas_off['top']
				};
			}

			t['plus_pos'] = function( x, y ) {
				return {
					x: x - 1 + t.canvas_off['left'],
					y: y - 1 + t.canvas_off['top']
				};
			}

			t['allow_undo_transform'] = function( el, redo, undo, foreach ) {
				var me = this,
						sel = me.canvas.Selection,
						contains = sel.contains( el ),
						s = contains ? sel.get_all() : S.set( el ),
						obj_id = [],
						om = [],
						m = [],
						foreach = qt.isF( foreach ) ? foreach : function() {};
				s.forEach( function( item ) {
					foreach( item );
					obj_id.push( item.attr( 'id' ) );
					om.push( ( item.data( 'orig-matrix' ) || new S.Matrix() ).clone() );
					m.push( ( item.matrix || new S.Matrix ).clone() );
				} );

				( function( obj_id, om, m ) { me.canvas.U.add( new S.Undoer.cmd( redo, undo, { obj_id:obj_id, om:om, m:m } ), true ); } )( obj_id, om, m );

				if ( contains )
					QS.cbs.trigger( 'selection-move-end', [ sel ] );
			};

			t['adjust_offset'] = function() {
				t.canvas_off = t.e.canvas.offset();
				if ( qt.isO( t.toolbar ) ) t.toolbar.redraw();
				if ( qt.isO( t.utils ) ) t.utils.redraw();
			};

			t.setting = function( name, value ) {
				if ( ! qt.is( name ) ) return canvas_settings;
				if ( ! qt.is( value ) ) return canvas_settings[ name ];
				canvas_settings[ name ] = value;
				t.saver.trigger();
			};

			function next_name() { return 'zone-' + ( next_id++ ); }

			function set_dims() {
				var adjust = function() {
							t.shp.attr( 'style', 'width:' + t.e.canvas.width() + 'px; height:' + t.e.canvas.height() + 'px;' );
							t.tool.attr( 'style', 'width:' + t.e.canvas.width() + 'px; height:' + t.e.canvas.height() + 'px;' );
							t.adjust_offset();
						},
						last = '';
				$( window ).off( 'resize.adjust' ).on( 'resize.adjust', function() {
					var cur = ( Math.random() * 99999 ) + '-' + ( Math.random() * 99999999 );
					last = cur;
					setTimeout( function() { if ( last == cur ) adjust(); }, 50 );
				} );
				adjust();
			}
			QS.cbs.add( 'canvas-start', set_dims )( -1000 );

			function _reinit_ui() {
				t.e.canvas = $( '<svg id="qsot-scui"></svg>' ).appendTo( t.e.main );
				t.canvas = _new_paper( t.e.canvas.get( 0 ) );
				t.canvas.next_name = next_name;
				t.cues = new QS.timed_cues();

				_setup_auto_saver();
				QS.cbs.add( 'before-save-seating', _save_seating_chart_settings );

				t.shp = t.canvas.g().attr( { id:'shapes' } );
				t.zones = t.canvas.g().attr( { id:'zones' } ).appendTo( t.shp );
				t.zoom_zones = t.canvas.g().attr( { id:'zoom-zones' } ).hide().appendTo( t.shp );

				var autosave = t.saver.get_autosave() || {}, loaded = false;
				if ( qt.is( O.data.zones ) ) {
					var arr = [];
					Object.keys( O.data.zones ).forEach( function( k ) { arr.push( O.data.zones[ k ] ); } )
					arr.sort( function( a, b ) { var am = qt.toInt( a.meta._order || 0 ), bm = qt.toInt( b.meta._order || 0 ); return am - bm; } );
					for ( var i = 0; i < arr.length; i++ )
						QS.cbs.trigger( 'create-from-save-' + arr[ i ].meta._subtype, [ arr[ i ], t ] )
				} else
				if ( qt.is( autosave.zones ) ) {
					loaded = true;
					var sld = [ true ];
					$( t.zones.node ).html( autosave.zones );
					QS.cbs.add( 'canvas-start', function() { t.canvas.Selection.set.apply( t.canvas.Selection, sld ); } )( 10000 );
				}

				// backdrop for debugging
				t.canvas.line( -40, -1, 40, -1 ).attr( { stroke:'#ccc', 'stroke-width':3, 'stroke-dasharray':[ 5, 5 ] } ).appendTo( t.shp );
				t.canvas.line( -1, -40, -1, 40 ).attr( { stroke:'#ccc', 'stroke-width':3, 'stroke-dasharray':[ 5, 5 ] } ).appendTo( t.shp );

				if ( qt.is( O.data.zoom_zones ) ) {
					var arr = [];
					Object.keys( O.data.zoom_zones ).forEach( function( k ) { arr.push( O.data.zoom_zones[ k ] ); } )
					arr.sort( function( a, b ) { var am = qt.toInt( a.meta._order || 0 ), bm = qt.toInt( b.meta._order || 0 ); return am - bm; } );
					for ( var i = 0; i < arr.length; i++ )
						QS.cbs.trigger( 'create-from-save-zoom-zone', [ arr[ i ], t ] )
				} else if ( qt.is( autosave.zoom_zones ) ) {
					loaded = true;
					$( t.zoom_zones.node ).html( autosave.zoom_zones ).find( '.DA' ).filter( '.SLD' ).each( function() {
						$( this ).attr( 'class', $( this ).attr( 'class' ).replace( /\bSLD\b/, '' ) );
					} );
				}

				if ( loaded ) {
					$( t.shp.node ).find( '.DA' ).each( function() {
						var el = S.node4ele( this );
						el.matrix = new S.Matrix( this.getCTM() );
						if ( el.hasClass( 'SLD' ) ) sld.push( el );
					} );
				}

				var def_settings = {};
				QS.cbs.trigger( 'canvas-settings-defaults', [ def_settings ] );
				$.extend( canvas_settings, def_settings );
				if ( qt.is( autosave.settings ) ) {
					canvas_settings = $.extend( {}, canvas_settings, autosave.settings );
				}
				QS.cbs.trigger( 'canvas-settings', [ canvas_settings ] )

				t.tool = t.canvas.g().attr( { id:'tools' } );

				QS.cbs.trigger( 'canvas-start', [ t.canvas, t ] );

				t.canvas.zoom.set_ele( t.shp );
				t.adjust_offset();
				t.toolbar = new QS.Buttonbar( t, { x:0, y:30, snap:'top left' } );
				t.utils = new QS.Buttonbar( t, { x:0, y:30, snap:'top right', id:'qsot-utils' } );
				_create_btns();
			}

			function _setup_auto_saver() {
				function saver( o ) {
					this.get = function( name ) {
						var value = QS.storage.get_data( this.o.prefix + name );
						QS.cbs.trigger( 'qsot-saver-get-' + name, [ name, value ] );
						return value;
					};

					this.set = function( name, value ) {
						QS.storage.set_data( this.o.prefix + name, value );
						QS.cbs.trigger( 'qsot-saver-set-' + name, [ name, value ] );
						return this;
					};

					this.remove = function( name ) {
						QS.storage.remove_data( this.o.prefix + name );
						QS.cbs.trigger( 'qsot-saver-remove-' + name, [ name ] );
						return this;
					};

					this.trigger = function() {
						this.set( _autosave_key(), create_autosave_package() );
					}

					function _autosave_key( pref ) {
						var pref = pref || 'autosave', post_id = $( '#post_ID' ).val();
						return pref + ':' + post_id;
					}

					this.remove_autosave = function() {
						return this.remove( _autosave_key() );
					}

					this.get_autosave = function() {
						return parse_autosave_package( this.get( _autosave_key() ) );
					}

					this.init = function() {
						var me = this;
						me.o = $.extend( { prefix: '' }, o );

						t.cues.add_cue(
							'autosave',
							function() { console.log( 'autosaving', _autosave_key() ); me.set( _autosave_key(), create_autosave_package() ); },
							15000
						);
					}

					this.init();
				}

				t.saver = new saver();
			}

			function parse_autosave_package( pack ) {
				return JSON.parse( pack );
			}

			function create_autosave_package() {
				return JSON.stringify( {
					settings:canvas_settings || {},
					zones: $( t.zones.node ).html(),
					zoom_zones: $( t.zoom_zones.node ).html()
				} );
			}

			function _create_btns() {
				t.toolbar.add_btn( {
					ele: t.toolbar.hud.path( 'M0,0L13,10L6,10L11,17L9,19L4,11L0,16z' ).attr( { style:'fill:#fff;' } ),
					name: 'pointer',
					title: 'Pointer Tool',
					start_active: _pointer_start,
					end_active: _pointer_end
				} );

				QS.cbs.add( 'create-btns', function( t ) {
					t.utils.add_btn( {
						ele: t.utils.hud.path( 'M0,0L10,10L5,10z' ),
						only_click: true,
						name: 'toggle-zoom-zones',
						title: 'Toggle Zoom Zones',
						click: function() {
							if ( 'draw' == mode ) {
								_zoom_zone_mode_start();
							} else {
								_zoom_zone_mode_end();
							}
						}
					} );
				} )( 1000 );

				QS.cbs.trigger( 'create-btns', [ t ] )
				t.trigger( 'create-btns', [ t ] )

				t.toolbar.activate( 'pointer' );
			}

			t.zoom_zone_ui = function( action ) {
				if ( $.inArray( action, [ 'start', 'stop' ] ) > -1 ) {
					if ( 'start' == action ) {
						_zoom_zone_mode_start();
					} else {
						_zoom_zone_mode_end();
					}
				}
			}

			function _zoom_zone_mode_start() {
				mode = 'zoom-zones';
				prev_context = t.canvas.Selection.get_context();
				t.canvas.Selection.set_mode( 'single' ).set_context( t.zoom_zones ).clear();
				t.zoom_zones.show();
			}

			function _zoom_zone_mode_end() {
				mode = 'draw';
				if ( prev_context ) t.canvas.Selection.set_context( prev_context );
				t.canvas.Selection.set_mode( 'multiple' ).clear();
				t.zoom_zones.hide();
			}

			function _pointer_start( e, x, y ) {
			}

			function _pointer_end( e, x, y ) {
			}

			function _setup_elements() {
				t.e.main = $( t.o.container ).empty();
				t.e.stts = $( '<div class="qsot-status-bar"></div>' ).appendTo( t.e.main );
				t.e.cnts = $( '<div class="counts right"></div>' ).appendTo( t.e.stts );
				function _update_counts() {
					var tot = $( '.DA', t.zones.node ).length, sld = t.canvas.Selection.length;
					t.e.cnts.text( sld + ' / ' + tot );
				}
				QS.cbs.add( 'canvas-start', function() {
					QS.cbs.add( 'deleted-elements', _update_counts );
					QS.cbs.add( 'shape-added', _update_counts );
					QS.cbs.add( 'shape-removed', _update_counts );
					QS.cbs.add( 'selection-changed', _update_counts );
					_update_counts();
				} );
				t.tooltip = new QS.Tooltip();
			}

			function _setup_events() {
				$( 'form#post' ).on( 'submit', function( e ) {
					QS.cbs.trigger( 'before-save-seating', [ t, this, e ] );
					$( '<input type="hidden" name="qsot-seating-ui" value="1" />' ).appendTo( this );
				} );
			}

			function _save_seating_chart_settings( t, form, e ) {
				var settings = $.extend( {}, canvas_settings );
				QS.cbs.trigger( 'seating-chart-settings-to-be-saved', [ settings, t, form ] );
				$( '<input type="hidden" name="qsot-seating-settings" />' ).appendTo( form ).val( JSON.stringify( settings ) );
			}

			t.set_options = function( o, value ) {
				if ( qt.isF( o ) ) {
					o.call( t.o, value );
				} else if ( qt.isO( o ) ) {
					t.o = $.extend( {}, defs, t.o, o );
				} else {
					t.o[ o ] = value;
				}
			}

			parse_request();
		}

		ui.cb = new QS.CB( ui, 'trigger', 'cb' );

		return ui;
	} )();

	QS.ShapeFactory = ( function() { 
		function SF( ui ) {
			if ( qt.isO( ui ) ) {
				this.type = this.type || 'shape';
				this.ui = this.hud = false;
				this.ui = ui;
				if ( qt.isO( ui.toolbar ) && qt.isO( ui.toolbar.hud ) ) this.hud = ui.toolbar.hud;
				this.init();
			}
		}

		SF.prototype = {
			_initialized: false,

			drag_mode: {
				drag: 'drag_',
				scale: 'scale_'
			},

			create_shape: function( base, skip_run ) {
				var me = this,
						skip_run = skip_run || false,
						fn = new S.Undoer.cmd(
							function() { fix_id( this ); me.redo_create.call( this, me ); },
							function() { me.undo_create.call( this, me ); },
							$.extend( true, { obj_id:false }, base )
						);
				me.ui.canvas.U.add( fn, skip_run );
				return fn.data.obj_id;
			},

			new_shape: function() { return undefined; },

			init_shape: function( shape ) {
				var me = this,
						cb = function( type, args ) {
							var mode = this.get_drag_mode();
							args.unshift( me );
							if ( qt.isF( me[ me.drag_mode[ mode ] + type ] ) )
								me[ me.drag_mode[ mode ] + type ].apply( this, args );
						};
				shape.addClass( 'DA' ).attr( 'kind', this.type ).set_drag_mode( 'drag' );

				var c = shape.clone;
				shape.clone = function() {
					var res = S._.wrap( this.node.cloneNode( true ) ); // c.apply( this, [].slice.call( arguments ) );
					res = me.init_shape( res );
					return res;
				};
				
				QS.cbs.trigger( 'shape-added', [ shape ] );

				return shape;
			},

			shape_from_save: function( save ) { return this.new_shape( save.meta ); },

			new_from_save: function( save ) {
				var shape = this.shape_from_save( save );
				return this.init_shape( shape );
			},

			current_fill: function() {
				return this.ui.canvas.CP.get() || '#000'; // this.shape_style.def.fill || '#000';
			},

			redo_create: function( me ) {
				var atts = $.extend( {}, me.shape_style.def, this.data.atts, { fill:me.current_fill(), id:this.data.obj_id } ),
						obj = me.new_shape( this.data ).attr( atts );
				if ( qt.isO( obj ) ) {
					me.init_shape( obj );
					this.data.atts = obj.all_attrs();
				}
			},

			undo_create: function( me ) {
				var obj = me.ui.zones.select( '#' + this.data.obj_id );
				if ( qt.isO( obj ) ) {
					obj.remove();
					QS.cbs.trigger( 'shape-removed' );
				}
			},

			shape_click: function( ev ) { ev.stopPropagation(); },
			shape_dblclick: function( ev ) { ev.stopPropagation();},
			shape_mouseover: function( ev ) { ev.stopPropagation(); },
			shape_mouseout: function( ev ) { ev.stopPropagation(); },

			adjust4zoom: function( x, y ) { return this.ui.canvas.zoom.adjust( x, y ); },

			scale_on_start: function( me ) {},
			scale_on_end: function( me ) {},
			scale_move: function( me, dx, dy, x, y, e ) {},
			scale_start: function( me, x, y, e ) {},
			scale_end: function( me, e ) {},

			drag_on_start: function( me ) {},
			drag_on_end: function( me ) {},
			drag_move: function( me, dx, dy, x, y, e ) {
				e.stopPropagation();
				var s, one = false,
						sel = me.ui.canvas.Selection,
						contains = sel.contains( this );
						xy = me.adjust4zoom( dx, dy );
				s = contains ? sel.get_all() : S.set( this );
				s.forEach( function( me ) {
					if ( me.hasClass( 'dragging' ) && qt.toInt( me.attr( 'locked' ) ) == 0 ) {
						one = true;
						me.addClass( 'moved' ).transform( ( new S.Matrix ).translate( xy.x, xy.y ).add( me.data( 'orig-matrix' ) ) );
					}
				} );
				if ( contains && one )
					QS.cbs.trigger( 'selection-moved', [ sel, xy.x, xy.y ] );
			},
			drag_start: function( me, x, y, e ) {
				e.stopPropagation();
				var s,
						sel = me.ui.canvas.Selection,
						contains = sel.contains( this );
				s = contains ? sel.get_all() : S.set( this );
				s.forEach( function( me ) {
					if ( qt.toInt( me.attr( 'locked' ) ) > 0 ) return;
					var m = qt.isO( me.matrix ) ? me.matrix.clone() : new S.Matrix();
					me.addClass( 'dragging' ).data( 'orig-matrix', m );
				} );
				QS.cbs.trigger( 'selection-move-start', [ sel, x, y ] );
				_enable_cancel( function() {
					s.forEach( function( me ) {
						me.removeClass( 'dragging' ).transform( me.data( 'orig-matrix' ) );
					} );
					if ( contains )
						QS.cbs.trigger( 'selection-move-cancel', [ sel ] );
				} );
			},
			drag_end: function( me, e ) {
				e.stopPropagation();
				if ( this.hasClass( 'dragging' ) && this.hasClass( 'moved' ) ) {
					me.ui.allow_undo_transform(
						this,
						function() {
							var i, ii;
							for ( i = 0, ii = this.data.obj_id.length; i < ii; i++ )
								me.ui.zones.select( '#' + this.data.obj_id[ i ] ).transform( this.data.m[ i ] );
						},
						function() {
							var i, ii;
							for ( i = 0, ii = this.data.obj_id.length; i < ii; i++ )
								me.ui.zones.select( '#' + this.data.obj_id[ i ] ).transform( this.data.om[ i ] );
						},
						function( el ) { el.removeClass( 'dragging' ).removeClass( 'moved' ); }
					);
				}
				_disable_cancel();
			},

			init: function( force ) {
				var force = force || false, me = this;
				if ( ! force && this._initialized ) return;
				me._initialized = true;

				function rndhex() { return ( '0' + Math.floor( Math.random() * 256 ).toString( 16 ) ).substr( -2 ); }

				me.shape_style = {
					def: {
						fill: function() { return '#' + rndhex() + rndhex() + rndhex(); }
					}
				};

				var sel_str = selectable.join( '.DA[kind="' + this.type + '"], ' ) + '.DA[kind="' + this.type + '"]', start = { x:0, y:0, on:false },
						cb = function( type, args ) {
							var that = S.node4ele( this ), mode = that.get_drag_mode();
							if ( ! mode )
								that.set_drag_mode( mode = 'drag' );
							args.unshift( me );
							if ( qt.isF( me[ me.drag_mode[ mode ] + type ] ) )
								me[ me.drag_mode[ mode ] + type ].apply( that, args );
						}, down = false;
				//me.ui.e.main
				// has to be shp, because of the 'draw shape' handlers that happen AFTER this is defined
				$( me.ui.shp.node )
					.on( 'click dblclick mouseover mouseout mousedown', function( ev ) { if ( down ) ev.stopPropagation(); } )
					.off( 'mousedown.qsot-drag', sel_str ).on( 'mousedown.qsot-drag', sel_str, function( ev ) {
						var ele = S.node4ele( this );
						if ( qt.toInt( ele.attr( 'locked' ) ) > 0 ) return;
						if ( ! ev.ctrlKey && ! ev.metaKey ) {
							//ev.stopPropagation();
							var pos = me.ui.pos( ev.pageX, ev.pageY ), args = [ pos.x, pos.y, ev ];
							start.x = pos.x;
							start.y = pos.y;
							start.on = this;
							down = true;
							return cb.call( this, 'start', args );
						}
					} );
				$( document ).on( 'mousemove.qsot-drag-' + this.type, function( ev ) {
					if ( down ) {
						ev.stopPropagation();
						var pos = me.ui.pos( ev.pageX, ev.pageY ), args = [ pos.x - start.x, pos.y - start.y, pos.x, pos.y, ev ];
						return cb.call( start.on, 'move', args );
					}
				}).on( 'mouseup.qsot-drag-' + this.type, function( ev ) {
					if ( down ) {
						ev.stopPropagation();
						start.x = start.y = 0;
						down = false;
						var res = cb.call( start.on, 'end', [ ev ] );
						start.on = false;
						return res;
					}
				} );
			},
			
			create_btn: function() {
				this.setup_button();
			},

			setup_button: function() {
				var me = this;
				me.ui.toolbar.add_btn( {
					name: me.type,
					title: me.title || qt.ucw( me.type ),
					ele: me.btn_icon(),
					click: _forward( me.btn_click, me ),
					dblclick: _forward( me.btn_dblclick, me ),
					start_active: _forward( me.btn_start_active, me ),
					end_active: _forward( me.btn_end_active, me )
				} );
			},

			btn_icon: function() { return null; },
			btn_click: function() {},
			btn_dblclick: function() {},
			btn_mouseover: function( ele, e, x, y ) {},
			btn_mouseout: function( ele, e, x, y ) {},
			btn_start_active: function( ele, bb ) { bb.ui.canvas.zoom.disallow_pan(); },
			btn_end_active: function( ele, bb ) { bb.ui.canvas.zoom.allow_pan(); }
		};

		SF.cb = new QS.CB( SF, 'trigger', 'cb' );

		return SF;
	} )();

	QS.CircleFactory = ( function() {
		var shptype = 'circle';
		function CF( ui ) {
			var t = this;
			t.type = shptype;
			QS.ShapeFactory.call( t, ui );
			t.shape_style.def.r = 20;

			t.new_shape = function( args ) {
				var sm = ( t.ui.shp.matrix || new S.Matrix ).split(), a = args.atts,
						x = qt.is( a.cx ) ? a.cx : ( qt.is( a.w ) ? ( a.w / 2 ) - sm.dx : 0 ),
						y = qt.is( a.cy ) ? a.cy : ( qt.is( a.h ) ? ( a.h / 2 ) - sm.dy : 0 ),
						m = ( new S.Matrix ).translate( x, y );
				return t.ui.canvas.circle( 0, 0, a.r || 1 ).transform( m ).appendTo( t.ui.zones );
			}

			t.shape_from_save = function( save ) {
				var a = { atts: {
						r: save.meta.r,
						cx: 0,//qt.toFloat( save.meta.cx || save.meta.x ),
						cy: 0 //qt.toFloat( save.meta.cy || save.meta.y )
					} },
					m = ( new S.Matrix() ).translate( qt.toFloat( save.meta.cx || save.meta.x ), qt.toFloat( save.meta.cy || save.meta.y ) ).rotate( qt.toFloat( save.meta.angle ) ),
					atts = {
						'unavail-fill': save.meta['unavail-fill'] || 'rgba( 128, 128, 128, 1 )',
						'unavail-fill-opacity': qt.is( save.meta['unavail-fill-opacity'] ) ? save.meta['unavail-fill-opacity'] : 1,
						fill: save.meta.fill || 'rgba( 0, 0, 0, 1 )',
						'fill-opacity': qt.is( save.meta['fill-opacity'] ) ? save.meta['fill-opacity'] : 1,
						id: fix_save_id( save.abbr ), //save.abbr || fix_id_field(),
						locked: save.meta.locked || 0,
						zone: save.name || '',
						capacity: save.capacity || ''
					};
				return this.new_shape( a ).attr( atts ).transform( m );
			}

			t.btn_icon = function() {
				if ( ! qt.is( t.hud ) ) return null;
				return t.hud.circle( 0, 0, 10 );
			}

			t.btn_click = function( ele, ev, x, y ) {
				// nothing special
			}

			t.btn_dblclick = function( ele, ev, x, y ) {
				var w = t.ui.e.canvas.width(),
						h = t.ui.e.canvas.height();
				t.create_shape( { atts:{ w:w, h:h } } );
			}

			var draw_drag = [
				function ( dx, dy, x, y, ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) && qt.isO( t.partial ) ) {
						ev.stopPropagation();
						t.ui.zones.addClass( 'moved' );
						t.partial.attr( { r:t.ui.canvas.zoom.to_scale( Math.sqrt( ( dx * dx ) + ( dy * dy ) ) ) } );
					}
				},
				function ( x, y, ev ) {
					ev.stopPropagation();
					var xy = t.ui.canvas.zoom.real_pos_to_virtual_pos( t.ui.pos( x, y ) ),
							args = fix_id( { data:{ atts:{ cx:xy.x, cy:xy.y } } } );
					t.ui.zones.addClass( 'drawing' );
					t.partial = t.new_shape( args.data ).attr( { fill:t.current_fill(), id:args.data.obj_id } ).data( 'new-data', args );
					_enable_cancel( function() {
						t.ui.zones.removeClass( 'drawing' );
						t.partial.remove();
						delete t.partial;
					} );
				},
				function ( ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) ) {
						ev.stopPropagation();
						var me = this,
								args = t.partial.data( 'new-data' ),
								atts = t.partial.all_attrs();
						$.extend( args.data.atts, atts );
						t.init_shape( t.partial.removeData( 'new-data' ) );
						if ( ! t.ui.zones.hasClass( 'moved' ) ) {
							t.ui.zones.removeClass( 'drawing' );
							t.partial.remove();
							delete t.partial;
						} else {
							t.ui.zones.removeClass( 'drawing' ).removeClass( 'moved' );
							t.create_shape( args.data, true );
						}
					}
					_disable_cancel();
				}
			];

			t.btn_start_active = function( ele, bb ) {
				t.ui.canvas.zoom.disallow_pan();
				//t.ui.canvas.undrag().drag.apply( t.ui.canvas, draw_drag );
				var start = { x:0, y:0, on:false }, down = false;
				t.ui.e.canvas
					.on( 'mousedown.draw', function( ev ) {
						down = true;
						start.x = ev.pageX;
						start.y = ev.pageY;
						start.on = this;
						var args = [ ev.pageX, ev.pageY, ev ];
						draw_drag[1].apply( this, args );
					} )
				$( window ).on( 'mousemove.draw', function( ev ) {
						if ( down ) {
							var args = [ ev.pageX - start.x, ev.pageY - start.y, ev.pageX, ev.pageY, ev ];
							draw_drag[0].apply( start.on, args );
						}
					} )
					.on( 'mouseup.draw', function( ev ) {
						if ( down ) {
							down = false;
							start.x = start.y = 0;
							var args = [ ev ];
							draw_drag[2].apply( start.on, args );
							start.on = false;
						}
					} );
			}

			t.btn_end_active = function( ele, bb ) {
				t.ui.e.canvas.off( '.draw' );
				t.ui.canvas.zoom.allow_pan();
			}
		}

		QS.ext( CF, QS.ShapeFactory );

		CF.cb = new QS.CB( CF, 'trigger', 'cb' );
		QS.SeatingUI.cb.add( 'create-btns', function( ui ) {
			( new CF( ui ) ).create_btn();
		} );

		var core_factory;
		QS.cbs.add( 'create-from-save-' + shptype, function( save, ui ) {
			if ( ! qt.is( core_factory ) ) core_factory = new CF( ui );
			save._ele = core_factory.new_from_save( save );
		} );

		return CF;
	} )();

	QS.SquareFactory = ( function() {
		var shptype = 'square';
		function QF( ui ) {
			var t = this;
			t.type = shptype;
			QS.ShapeFactory.call( t, ui );
			t.shape_style.def.width = t.shape_style.def.height = 40;

			t.btn_icon = function() {
				if ( ! qt.is( t.hud ) ) return null;
				return t.hud.rect( 0, 0, 20, 20 );
			}

			t.btn_click = function( ele, ev, x, y ) {
				// nothing special
			}

			t.btn_dblclick = function( ele, ev, x, y ) {
				var w = t.ui.e.canvas.width(),
						h = t.ui.e.canvas.height();
				t.create_shape( { atts:{ w:w, h:h, width:t.shape_style.def.width, height:t.shape_style.def.height } } );
			}

			t.new_shape = function( args ) {
				var sm = ( t.ui.shp.matrix || new S.Matrix ).split(), a = args.atts, w2 = a.width / 2, h2 = a.height / 2,
						x = qt.is( a.x ) ? a.x : ( qt.is( a.w ) ? ( a.w / 2 ) - sm.dx - w2 : 0 ),
						y = qt.is( a.y ) ? a.y : ( qt.is( a.h ) ? ( a.h / 2 ) - sm.dy - h2 : 0 ),
						m = ( new S.Matrix ).translate( x, y );
				return t.ui.canvas.rect( 0, 0, a.width, a.height ).transform( m ).appendTo( t.ui.zones ).data( 'starting-m', m.clone() );
			}

			t.shape_from_save = function( save ) {
				var w = ! qt.is( save.meta.x ) ? t.ui.e.canvas.width() : 0,
						h = ! qt.is( save.meta.y ) ? t.ui.e.canvas.height() : 0,
						a = { atts: {
							w: w,
							h: h,
							x: 0, //qt.toFloat( save.meta.x || ( w / 2 ) ),
							y: 0, //qt.toFloat( save.meta.y || ( h / 2 ) ),
							width: qt.toFloat( save.meta.width || this.shape_style.def.width ),
							height: qt.toFloat( save.meta.height || this.shape_style.def.height )
						} },
						m = ( new S.Matrix() ).translate( qt.toFloat( save.meta.x || ( w / 2 ) ), qt.toFloat( save.meta.y || ( h / 2 ) ) ).rotate( qt.toFloat( save.meta.angle ) ),
						atts = {
							'unavail-fill': save.meta['unavail-fill'] || 'rgba( 128, 128, 128, 1 )',
							'unavail-fill-opacity': qt.is( save.meta['unavail-fill-opacity'] ) ? save.meta['unavail-fill-opacity'] : 1,
							fill: save.meta.fill || 'rgba( 0, 0, 0, 1 )',
							'fill-opacity': qt.is( save.meta['fill-opacity'] ) ? save.meta['fill-opacity'] : 1,
							id: fix_save_id( save.abbr ), //save.abbr || fix_id_field(),
							locked: save.meta.locked || 0,
							zone: save.name || '',
							capacity: save.capacity || ''
						};
				return this.new_shape( a ).attr( atts ).transform( m );
			}

			var s = { x:0, y:0 }, last = { dx:0, dy:0, x:0, y:0 }, desc = { x:0, y:0, width:0, height:0 }, draw_drag = [
				function ( dx, dy, x, y, ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) && qt.isO( t.partial ) ) {
						ev.stopPropagation();
						t.ui.zones.addClass( 'moved' );
						var dx = { v:Math.abs( dx ), d:( dx < 0 ) ? -1 : 1 }, dy = { v:Math.abs( dy ), d:( dy < 0 ) ? -1 : 1 }, d = ev.ctrlKey || ev.metaKey ? Math.max( dx.v, dy.v ) : Math.min( dx.v, dy.v ),
								m = ( t.partial.data( 'starting-m' ) || new S.Matrix ).clone().translate( Math.min( 0, ( d * dx.d ) ), Math.min( 0, ( d * dy.d ) ) );
						//desc.x = Math.min( s.x, s.x + ( d * dx.d ) );
						//desc.y = Math.min( s.y, s.y + ( d * dy.d ) );
						desc.width = t.ui.canvas.zoom.to_scale( Math.abs( d ) );
						desc.height = t.ui.canvas.zoom.to_scale( Math.abs( d ) );
						t.partial.attr( desc ).transform( m );
					}
				},
				function ( x, y, ev ) {
					ev.stopPropagation();
					var xy = t.ui.canvas.zoom.real_pos_to_virtual_pos( t.ui.pos( x, y ) ),
							args = fix_id( { data:{ atts:{ x:xy.x, y:xy.y, width:1, height:1 } } } );
					s.x = xy.x;
					s.y = xy.y;
					t.ui.zones.addClass( 'drawing' );
					t.partial = t.new_shape( args.data ).attr( { fill:t.current_fill(), id:args.data.obj_id } ).data( 'new-data', args );
					_enable_cancel( function() {
						t.ui.zones.removeClass( 'drawing' );
						t.partial.remove();
						delete t.partial;
					} );
				},
				function ( ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) ) {
						ev.stopPropagation();
						var me = this,
								args = t.partial.data( 'new-data' ),
								atts = t.partial.all_attrs();
						$.extend( args.data.atts, atts );
						t.init_shape( t.partial.removeData( 'new-data' ) );
						if ( ! t.ui.zones.hasClass( 'moved' ) ) {
							t.ui.zones.removeClass( 'drawing' );
							t.partial.remove();
							delete t.partial;
						} else {
							t.ui.zones.removeClass( 'drawing' ).removeClass( 'moved' );
							t.create_shape( args.data, true );
						}
					}
					_disable_cancel();
				}
			];
			t.btn_start_active = function( ele, bb ) {
				t.ui.canvas.zoom.disallow_pan();
				//t.ui.canvas.undrag().drag.apply( t.ui.canvas, draw_drag );
				var start = { x:0, y:0, on:false }, down = false;
				t.ui.e.canvas
					.on( 'mousedown.draw', function( ev ) {
						down = true;
						start.x = ev.pageX;
						start.y = ev.pageY;
						start.on = this;
						var args = [ ev.pageX, ev.pageY, ev ];
						draw_drag[1].apply( this, args );
					} )
				$( window ).on( 'mousemove.draw', function( ev ) {
						if ( down ) {
							var args = [ ev.pageX - start.x, ev.pageY - start.y, ev.pageX, ev.pageY, ev ];
							last.dx = args[0];
							last.dy = args[1];
							last.x = args[2];
							last.y = args[3];
							draw_drag[0].apply( start.on, args );
						}
					} )
					.on( 'mouseup.draw', function( ev ) {
						if ( down ) {
							down = false;
							start.x = start.y = 0;
							var args = [ ev ];
							draw_drag[2].apply( start.on, args );
							start.on = false;
						}
					} )
					.on( 'keyup.draw keydown.draw', function( ev ) {
						if ( down ) {
							var args = [ last.dx, last.dy, last.x, last.y, ev ];
							draw_drag[0].apply( start.on, args );
						}
					} );
			}

			t.btn_end_active = function( ele, bb ) {
				t.ui.e.canvas.off( '.draw' );
				t.ui.canvas.zoom.allow_pan();
			}
		}

		QS.ext( QF, QS.ShapeFactory );

		QF.cb = new QS.CB( QF, 'trigger', 'cb' );
		QS.SeatingUI.cb.add( 'create-btns', function( ui ) {
			( new QF( ui ) ).create_btn();
		} );

		var core_factory;
		QS.cbs.add( 'create-from-save-' + shptype, function( save, ui ) {
			if ( ! qt.is( core_factory ) ) core_factory = new QF( ui );
			save._ele = core_factory.new_from_save( save );
		} );

		return QF;
	} )();

	QS.RectangleFactory = ( function() {
		var shptype = 'rectangle';

		function RF( ui ) {
			var t = this;
			t.type = shptype;
			QS.ShapeFactory.call( t, ui );
			t.shape_style.def.width = 60;
			t.shape_style.def.height = 30;

			t.btn_icon = function() {
				if ( ! qt.is( t.hud ) ) return null;
				return t.hud.rect( 0, 0, 20, 12 );
			}

			t.btn_click = function( ele, ev, x, y ) {
				// nothing special
			}

			t.btn_dblclick = function( ele, ev, x, y ) {
				var w = t.ui.e.canvas.width(),
						h = t.ui.e.canvas.height();
				t.create_shape( { atts:{ w:w, h:h, width:t.shape_style.def.width, height:t.shape_style.def.height } } );
			}

			t.new_shape = function( args ) {
				var sm = ( t.ui.shp.matrix || new S.Matrix ).split(), a = args.atts, w2 = a.width / 2, h2 = a.height / 2,
						x = qt.is( a.x ) ? a.x : ( qt.is( a.w ) ? ( a.w / 2 ) - sm.dx - w2 : 0 ),
						y = qt.is( a.y ) ? a.y : ( qt.is( a.h ) ? ( a.h / 2 ) - sm.dy - h2 : 0 ),
						m = ( new S.Matrix ).translate( x, y );
				return t.ui.canvas.rect( 0, 0, a.width, a.height ).transform( m ).appendTo( t.ui.zones ).data( 'starting-m', m.clone() );
			}

			t.shape_from_save = function( save ) {
				var w = ! qt.is( save.meta.x ) ? t.ui.e.canvas.width() : 0,
						h = ! qt.is( save.meta.y ) ? t.ui.e.canvas.height() : 0,
						a = { atts: {
							w: w,
							h: h,
							x: 0, //qt.toFloat( save.meta.x || ( w / 2 ) ),
							y: 0, //qt.toFloat( save.meta.y || ( h / 2 ) ),
							width: qt.toFloat( save.meta.width || this.shape_style.def.width ),
							height: qt.toFloat( save.meta.height || this.shape_style.def.height )
						} },
						m = ( new S.Matrix() ).translate( qt.toFloat( save.meta.x || ( w / 2 ) ), qt.toFloat( save.meta.y || ( h / 2 ) ) ).rotate( qt.toFloat( save.meta.angle ) ),
						atts = {
							'unavail-fill': save.meta['unavail-fill'] || 'rgba( 128, 128, 128, 1 )',
							'unavail-fill-opacity': qt.is( save.meta['unavail-fill-opacity'] ) ? save.meta['unavail-fill-opacity'] : 1,
							fill: save.meta.fill || 'rgba( 0, 0, 0, 1 )',
							'fill-opacity': qt.is( save.meta['fill-opacity'] ) ? save.meta['fill-opacity'] : 1,
							id: fix_save_id( save.abbr ), //save.abbr || fix_id_field(),
							locked: save.meta.locked || 0,
							zone: save.name || '',
							capacity: save.capacity || ''
						};
				return this.new_shape( a ).attr( atts ).transform( m );
			}

			var s = { x:0, y:0 }, last = { dx:0, dy:0, x:0, y:0 }, desc = { x:0, y:0, width:0, height:0 }, draw_drag = [
				function ( dx, dy, x, y, ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) && qt.isO( t.partial ) ) {
						ev.stopPropagation();
						t.ui.zones.addClass( 'moved' );
						var dx = { v:Math.abs( dx ), d:( dx < 0 ) ? -1 : 1 }, dy = { v:Math.abs( dy ), d:( dy < 0 ) ? -1 : 1 },
								m = ( t.partial.data( 'starting-m' ) || new S.Matrix ).clone().translate( Math.min( 0, ( dx.v * dx.d ) ), Math.min( 0, ( dy.v * dy.d ) ) );
						desc.width = t.ui.canvas.zoom.to_scale( Math.abs( dx.v ) );
						desc.height = t.ui.canvas.zoom.to_scale( Math.abs( dy.v ) );
						t.partial.attr( desc ).transform( m );
					}
				},
				function ( x, y, ev ) {
					ev.stopPropagation();
					var xy = t.ui.canvas.zoom.real_pos_to_virtual_pos( t.ui.pos( x, y ) ),
							args = fix_id( { data:{ atts:{ x:xy.x, y:xy.y, width:1, height:1 } } } );
					s.x = xy.x;
					s.y = xy.y;
					t.ui.zones.addClass( 'drawing' );
					t.partial = t.new_shape( args.data ).attr( { fill:t.current_fill(), id:args.data.obj_id } ).data( 'new-data', args );
					_enable_cancel( function() {
						t.ui.zones.removeClass( 'drawing' );
						t.partial.remove();
						delete t.partial;
					} );
				},
				function ( ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) ) {
						ev.stopPropagation();
						var me = this,
								args = t.partial.data( 'new-data' ),
								atts = t.partial.all_attrs();
						$.extend( args.data.atts, atts );
						t.init_shape( t.partial.removeData( 'new-data' ) );
						if ( ! t.ui.zones.hasClass( 'moved' ) ) {
							t.ui.zones.removeClass( 'drawing' );
							t.partial.remove();
							delete t.partial;
						} else {
							t.ui.zones.removeClass( 'drawing' ).removeClass( 'moved' );
							t.create_shape( args.data, true );
						}
					}
					_disable_cancel();
				}
			];

			t.btn_start_active = function( ele, bb ) {
				t.ui.canvas.zoom.disallow_pan();
				//t.ui.canvas.undrag().drag.apply( t.ui.canvas, draw_drag );
				var start = { x:0, y:0, on:false }, down = false;
				t.ui.e.canvas
					.on( 'mousedown.draw', function( ev ) {
						down = true;
						start.x = ev.pageX;
						start.y = ev.pageY;
						start.on = this;
						var args = [ ev.pageX, ev.pageY, ev ];
						draw_drag[1].apply( this, args );
					} )
				$( window ).on( 'mousemove.draw', function( ev ) {
						if ( down ) {
							var args = [ ev.pageX - start.x, ev.pageY - start.y, ev.pageX, ev.pageY, ev ];
							last.dx = args[0];
							last.dy = args[1];
							last.x = args[2];
							last.y = args[3];
							draw_drag[0].apply( start.on, args );
						}
					} )
					.on( 'mouseup.draw', function( ev ) {
						if ( down ) {
							down = false;
							start.x = start.y = 0;
							var args = [ ev ];
							draw_drag[2].apply( start.on, args );
							start.on = false;
						}
					} )
					.on( 'keyup.draw keydown.draw', function( ev ) {
						if ( down ) {
							var args = [ last.dx, last.dy, last.x, last.y, ev ];
							draw_drag[0].apply( start.on, args );
						}
					} );
			}

			t.btn_end_active = function( ele, bb ) {
				t.ui.e.canvas.off( '.draw' );
				t.ui.canvas.zoom.allow_pan();
			}
		}

		QS.ext( RF, QS.ShapeFactory );

		RF.cb = new QS.CB( RF, 'trigger', 'cb' );
		QS.SeatingUI.cb.add( 'create-btns', function( ui ) {
			( new RF( ui ) ).create_btn();
		} );

		var core_factory;
		QS.cbs.add( 'create-from-save-' + shptype, function( save, ui ) {
			if ( ! qt.is( core_factory ) ) core_factory = new RF( ui );
			save._ele = core_factory.new_from_save( save );
		} );

		return RF;
	} )();

	QS.ImageFactory = ( function() {
		var shptype = 'image';
		function IM( ui ) {
			var t = this;
			t.type = shptype;
			QS.ShapeFactory.call( t, ui );

			t.btn_icon = function() {
				if ( ! qt.is( t.hud ) ) return null;
				var g = t.hud.g();
				t.hud.rect( 0, 0, 20, 20 ).appendTo( g );
				t.hud.circle( 5, 5, 2 ).attr( { style:'fill:#fff; stroke:#fff;' } ).appendTo( g );
				t.hud.path( 'M0,12Q5,18 10,8Q15,3 20,6L20,20L0,20z' ).attr( { style:'fill:#999;' } ).appendTo( g );
				return g;
			}

			t.btn_click = function( ele, btn, ev ) {
				QS.popMediaBox.apply( this, [ ev, {
					with_selection: function( attachment ) {
						var full = attachment.sizes.full;
						t.create_shape( { atts:{ src:full.url, x:0, y:0, width:full.width, height:full.height, 'image-id':attachment.id } } );
					}
				} ] );
			}

			t.btn_dblclick = function( ele, ev, x, y ) {
			}

			t.new_shape = function( args ) {
				var a = args.atts;
				return t.ui.canvas.image( a.src, a.x, a.y, a.width, a.height ).attr( { locked:'1', 'image-id':a['image-id'] } ).appendTo( t.ui.zones );
			}

			t.shape_from_save = function( save ) {
				var w = ! qt.is( save.meta.x ) ? t.ui.e.canvas.width() : 0,
						h = ! qt.is( save.meta.y ) ? t.ui.e.canvas.height() : 0,
						a = { atts: {
							w: w,
							h: h,
							x: qt.toFloat( save.meta.x || ( w / 2 ) ),
							y: qt.toFloat( save.meta.y || ( h / 2 ) ),
							src: save.meta.src || '',
							width: qt.toFloat( save.meta.width || this.shape_style.def.width ),
							height: qt.toFloat( save.meta.height || this.shape_style.def.height )
						} },
						atts = {
							'unavail-fill': save.meta['unavail-fill'] || 'rgba( 128, 128, 128, 1 )',
							'unavail-fill-opacity': qt.is( save.meta['unavail-fill-opacity'] ) ? save.meta['unavail-fill-opacity'] : 1,
							fill: save.meta.fill || 'rgba( 0, 0, 0, 1 )',
							'fill-opacity': qt.is( save.meta['fill-opacity'] ) ? save.meta['fill-opacity'] : 1,
							'image-id': save.meta['image-id'] || 0,
							src: save.meta.src || '',
							id: fix_save_id( save.abbr ), //save.abbr || fix_id_field(),
							locked: save.meta.locked || 0,
							'bg-img': save.meta.bg || '0',
							zone: save.name || '',
							capacity: save.capacity || ''
						};
				return this.new_shape( a ).attr( atts );
			}

			t.setup_button = function() {
				var me = this;
				me.ui.toolbar.add_btn( {
					name: me.type,
					only_click: true,
					title: me.title || qt.ucw( me.type ),
					ele: me.btn_icon(),
					click: _forward( me.btn_click, me )
				} );
			}

			t.btn_start_active = function( ele, bb ) {
			}

			t.btn_end_active = function( ele, bb ) {
			}
		}

		QS.ext( IM, QS.ShapeFactory );

		IM.cb = new QS.CB( IM, 'trigger', 'cb' );
		QS.SeatingUI.cb.add( 'create-btns', function( ui ) {
			( new IM( ui ) ).create_btn();
		} )( -2000 );

		var core_factory;
		QS.cbs.add( 'create-from-save-' + shptype, function( save, ui ) {
			if ( ! qt.is( core_factory ) ) core_factory = new IM( ui );
			save._ele = core_factory.new_from_save( save );
		} );

		return IM;
	} )();

	QS.LineFactory = ( function() {
		function L( ui ) {
			var t = this;
			t.type = 'line';
			QS.ShapeFactory.call( t, ui );

			t.create_btn = function(){};

			t.btn_dblclick = function( ele, ev, x, y ) {
				var w = t.ui.e.canvas.width(),
						h = t.ui.e.canvas.height();
				t.create_shape( { atts:{ w:w, h:h, width:t.shape_style.def.width, height:t.shape_style.def.height } } );
			}

			t.new_shape = function( args ) {
				var sm = ( t.ui.shp.matrix || new S.Matrix ).split(), a = args.atts, w2 = a.width / 2, h2 = a.height / 2;
				return t.ui.canvas.line( a.x, a.y, a.x2, a.y2 ).attr( { stroke:'#000', 'stroke-width':t.ui.canvas.zoom.to_scale( 2 ) } ).appendTo( t.ui.shp );
			}

			var s = { x:0, y:0 }, last = { dx:0, dy:0, x:0, y:0 }, desc = { x:0, y:0, width:0, height:0 }, draw_drag = [
				function ( dx, dy, x, y, ev ) {
					if ( t.ui.shp.hasClass( 'drawing' ) && qt.isO( t.partial ) ) {
						ev.stopPropagation();
						t.ui.shp.addClass( 'moved' );
						desc.x = s.x;
						desc.y = s.y;
						desc.x2 = desc.x + t.ui.canvas.zoom.to_scale( dx );
						desc.y2 = desc.y + t.ui.canvas.zoom.to_scale( dy );
						t.partial.attr( desc );
					}
				},
				function ( x, y, ev ) {
					ev.stopPropagation();
					var xy = t.ui.canvas.zoom.real_pos_to_virtual_pos( t.ui.pos( x, y ) ),
							args = fix_id( { data:{ atts:{ x:xy.x, y:xy.y, x2:xy.x + 1, y2:xy.y + 1 } } } );
					s.x = xy.x;
					s.y = xy.y;
					t.ui.shp.addClass( 'drawing' );
					t.partial = t.new_shape( args.data ).attr( { fill:t.current_fill(), id:args.data.obj_id } ).data( 'new-data', args );
					_enable_cancel( function() {
						t.ui.shp.removeClass( 'drawing' );
						t.partial.remove();
						delete t.partial;
					} );
				},
				function ( ev ) {
					ev.stopPropagation();
					var me = this,
							args = t.partial.data( 'new-data' ),
							atts = t.partial.all_attrs();
					$.extend( args.data.atts, atts );
					t.ui.shp.removeClass( 'drawing' ).removeClass( 'moved' );
					t.partial.remove();
					delete t.partial;
					_disable_cancel();
				}
			];

			t.btn_start_active = function( ele, bb, with_line ) {
				t.ui.canvas.zoom.disallow_pan();
				//t.ui.canvas.undrag().drag.apply( t.ui.canvas, draw_drag );
				var start = { x:0, y:0, on:false }, down = false;
				t.ui.e.canvas
					.on( 'mousedown.draw', function( ev ) {
						down = true;
						last.x = start.x = ev.pageX;
						last.y = start.y = ev.pageY;
						start.on = this;
						var args = [ ev.pageX, ev.pageY, ev ];
						draw_drag[1].apply( this, args );
					} )
				$( window ).on( 'mousemove.draw', function( ev ) {
						if ( down ) {
							var args = [ ev.pageX - start.x, ev.pageY - start.y, ev.pageX, ev.pageY, ev ];
							last.dx = args[0];
							last.dy = args[1];
							last.x = args[2];
							last.y = args[3];
							draw_drag[0].apply( start.on, args );
						}
					} )
					.on( 'mouseup.draw', function( ev ) {
						if ( down ) {
							down = false;
							var args = [ ev ];
							draw_drag[2].apply( start.on, args );
							with_line( [ { x:start.x, y:start.y }, { x:last.x, y:last.y } ] );
							start.x = start.y = 0;
							start.on = false;
						}
					} )
					.on( 'keyup.draw keydown.draw', function( ev ) {
						if ( down ) {
							var args = [ last.dx, last.dy, last.x, last.y, ev ];
							draw_drag[0].apply( start.on, args );
						}
					} );
				return t;
			}

			t.btn_end_active = function( ele, bb ) {
				t.ui.e.canvas.off( '.draw' );
				t.ui.canvas.zoom.allow_pan();
				return t;
			}
		}

		QS.ext( L, QS.ShapeFactory );

		L.cb = new QS.CB( L, 'trigger', 'cb' );

		return L;
	} )();

	QS.ZoomZoneFactory = ( function() {
		var shptype = 'zoom-zone';

		function RF( ui ) {
			var t = this;
			t.type = shptype;
			QS.ShapeFactory.call( t, ui );

			var p = t.ui.canvas.g();
			t.ui.canvas.rect( 0, 0, 10, 10 ).attr( { fill:'#000', stroke:'transparent', 'fill-opacity':0.2 } ).appendTo( p );
			t.ui.canvas.path( 'M0,0L10,10' ).attr( { fill:'transparent', stroke:'#000' } ).appendTo( p );
			// create the pattern and name it so that it is available on subsequent page loads by the same name
			p = p.toPattern( 0, 0, 10, 10 ).attr( { id:( p.id = 'slash-lines' ) } );

			t.shape_style.def.width = 60;
			t.shape_style.def.height = 30;
			t.shape_style.def.fill = p;

			t.btn_icon = function() {
				if ( ! qt.is( t.hud ) ) return null;
				return t.hud.rect( 0, 0, 20, 12 );
			}

			t.btn_click = function( ele, ev, x, y ) {
				// nothing special
			}

			t.new_shape = function( args ) {
				var sm = ( t.ui.shp.matrix || new S.Matrix ).split(), a = args.atts, w2 = a.width / 2, h2 = a.height / 2,
						x = qt.is( a.x ) ? a.x : ( qt.is( a.w ) ? ( a.w / 2 ) - sm.dx - w2 : 0 ),
						y = qt.is( a.y ) ? a.y : ( qt.is( a.h ) ? ( a.h / 2 ) - sm.dy - h2 : 0 ),
						m = ( new S.Matrix ).translate( x, y );
				return t.ui.canvas.rect( 0, 0, a.width, a.height ).transform( m ).appendTo( t.ui.zoom_zones ).data( 'starting-m', m.clone() );
			}

			t.shape_from_save = function( save ) {
				var w = ! qt.is( save.meta.x ) ? t.ui.e.canvas.width() : 0,
						h = ! qt.is( save.meta.y ) ? t.ui.e.canvas.height() : 0,
						a = { atts: {
							w: w,
							h: h,
							x: qt.toFloat( save.meta.x || ( w / 2 ) ),
							y: qt.toFloat( save.meta.y || ( h / 2 ) ),
							src: save.meta.src || '',
							width: qt.toFloat( save.meta.width || this.shape_style.def.width ),
							height: qt.toFloat( save.meta.height || this.shape_style.def.height )
						} },
						atts = {
							fill: save.meta.fill || 'url(#slash-lines)',
							'fill-opacity': qt.is( save.meta['fill-opacity'] ) ? save.meta['fill-opacity'] : 1,
							id: fix_save_id( save.abbr ), //save.abbr || fix_id_field(),
							'zoom-lvl': qt.is( save.meta[ 'zoom_level' ] ) ? save.meta[ 'zoom_level' ] : 1.1,
							zone: save.name || ''
						};
				return this.new_shape( a ).attr( atts );
			}

			var s = { x:0, y:0 }, last = { dx:0, dy:0, x:0, y:0 }, desc = { x:0, y:0, width:0, height:0 }, draw_drag = [
				function ( dx, dy, x, y, ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) && qt.isO( t.partial ) ) {
						ev.stopPropagation();
						t.ui.zones.addClass( 'moved' );
						var dx = { v:Math.abs( dx ), d:( dx < 0 ) ? -1 : 1 }, dy = { v:Math.abs( dy ), d:( dy < 0 ) ? -1 : 1 },
								m = ( t.partial.data( 'starting-m' ) || new S.Matrix ).clone().translate( Math.min( 0, ( dx.v * dx.d ) ), Math.min( 0, ( dy.v * dy.d ) ) );
						desc.width = t.ui.canvas.zoom.to_scale( Math.abs( dx.v ) );
						desc.height = t.ui.canvas.zoom.to_scale( Math.abs( dy.v ) );
						t.partial.attr( desc ).transform( m );
					}
				},
				function ( x, y, ev ) {
					ev.stopPropagation();
					var xy = t.ui.canvas.zoom.real_pos_to_virtual_pos( t.ui.pos( x, y ) ),
							args = fix_id( { data:{ atts:{ x:xy.x, y:xy.y, width:1, height:1 } } } );
					s.x = xy.x;
					s.y = xy.y;
					t.ui.zones.addClass( 'drawing' );
					t.partial = t.new_shape( args.data ).attr( $.extend( { 'min-zoom':t.ui.canvas.zoom.get_zoom() }, t.shape_style.def, { id:args.data.obj_id } ) ).data( 'new-data', args );
					_enable_cancel( function() {
						t.ui.zones.removeClass( 'drawing' );
						t.partial.remove();
						delete t.partial;
					} );
				},
				function ( ev ) {
					if ( t.ui.zones.hasClass( 'drawing' ) ) {
						ev.stopPropagation();
						var me = this,
								args = t.partial.data( 'new-data' ),
								atts = t.partial.all_attrs();
						$.extend( args.data.atts, atts );
						t.init_shape( t.partial.removeData( 'new-data' ) );
						if ( ! t.ui.zones.hasClass( 'moved' ) ) {
							t.ui.zones.removeClass( 'drawing' );
							t.partial.remove();
							delete t.partial;
						} else {
							t.ui.zones.removeClass( 'drawing' ).removeClass( 'moved' );
							t.create_shape( args.data, true );
						}
					}
					_disable_cancel();
				}
			];

			t.setup_button = function() {
				var me = this;
				me.ui.utils.add_btn( {
					name: me.type,
					title: me.title || qt.ucw( me.type ),
					ele: me.btn_icon(),
					click: _forward( me.btn_click, me ),
					start_active: _forward( me.btn_start_active, me ),
					end_active: _forward( me.btn_end_active, me )
				} );
			}

			t.btn_start_active = function( ele, bb ) {
				t.ui.zoom_zone_ui( 'start' );
				t.ui.canvas.zoom.disallow_pan();
				//t.ui.canvas.undrag().drag.apply( t.ui.canvas, draw_drag );
				var start = { x:0, y:0, on:false }, down = false;
				t.ui.e.canvas
					.on( 'mousedown.draw', function( ev ) {
						down = true;
						start.x = ev.pageX;
						start.y = ev.pageY;
						start.on = this;
						var args = [ ev.pageX, ev.pageY, ev ];
						draw_drag[1].apply( this, args );
					} )
				$( window ).on( 'mousemove.draw', function( ev ) {
						if ( down ) {
							var args = [ ev.pageX - start.x, ev.pageY - start.y, ev.pageX, ev.pageY, ev ];
							last.dx = args[0];
							last.dy = args[1];
							last.x = args[2];
							last.y = args[3];
							draw_drag[0].apply( start.on, args );
						}
					} )
					.on( 'mouseup.draw', function( ev ) {
						if ( down ) {
							down = false;
							start.x = start.y = 0;
							var args = [ ev ];
							draw_drag[2].apply( start.on, args );
							start.on = false;
						}
					} )
					.on( 'keyup.draw keydown.draw', function( ev ) {
						if ( down ) {
							var args = [ last.dx, last.dy, last.x, last.y, ev ];
							draw_drag[0].apply( start.on, args );
						}
					} );
			}

			t.btn_end_active = function( ele, bb ) {
				t.ui.zoom_zone_ui( 'stop' );
				t.ui.e.canvas.off( '.draw' );
				t.ui.canvas.zoom.allow_pan();
			}
		}

		QS.ext( RF, QS.ShapeFactory );

		RF.cb = new QS.CB( RF, 'trigger', 'cb' );
		QS.SeatingUI.cb.add( 'create-btns', function( ui ) {
			( new RF( ui ) ).create_btn();
		} );

		var core_factory;
		QS.cbs.add( 'create-from-save-' + shptype, function( save, ui ) {
			if ( ! qt.is( core_factory ) ) core_factory = new RF( ui );
			save._ele = core_factory.new_from_save( save );
		} );

		return RF;
	} )();
} )( jQuery, QS, Snap, QS.Tools );
