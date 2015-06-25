var QS = QS || {};

( function( $, S, qt ) {
	var has = 'hasOwnProperty', features = {}, hasClass, button_bars = {}, bbar_ind = 1,
			event_names = [ 'click', 'mouseout', 'mouseover', 'dblclick', 'mousemove', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel' ];

	// additional type checks
	qt.isB = function(v) { return typeof v == 'boolean'; };
	qt.isS = function(v) { return typeof v == 'string'; };
	qt.isN = function(v) { return typeof v == 'number'; };
	qt.isC = function(v, c) { return qt.isO( v ) && v.constructor == c ; };

	// prevent dragging in firefox ono ur canvas, because it makes it super difficult to draw on top an image
	$( document ).on( "dragstart", function( e ) {
		if ( $( e.target ).closest( '.event-area-ticket-selection-form' ).length )
			return false;
	} );

	( function() {
		var d = document.createElement( 'div' );
		features.clsList = qt.is( d.classList ) && qt.isF( d.classList.remove );
		delete d;
	} )();

	// fix jQuery so that it properly checks classes on svg elements and html elements alike, where ever they may exist.
	// without this, SVG objects (like circle) does not properly return true for hasClass() when the class is assigned
	( function( $ ) {
		hasClass = function( selector ) {
			if ( features.clsList && qt.is( this[0].classList ) ) {
				return this[0].classList && this[0].classList.contains( selector );
			} else {
				return $.trim( qt.is( this[0].className) ? this[0].className : this.attr( 'class' ) ).split( /[\s\uFEFF\xA0]+/g ).indexOf( selector ) > -1;
			}
		};
	} )( $ );
	$.extend( $.fn, { hasClass: hasClass } );

	S.plugin( function( S, E, P, G, F ) {
		// polyfill stuff
		E.prototype.hide = function() { return this.attr( 'visibility', 'hidden' ); };
		E.prototype.show = function() { return this.attr( 'visibility', 'visible' ); };

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

			/*
			var me = this;
			$( window ).off( 'resize.calc' ).on( 'resize.calc', function() {
				var cur = ( Math.random() * 999999999 ) + '-' + ( Math.random() * 999999 );
				last = cur;
				setTimeout( function() { if ( last == cur ) me.calc_view_port(); }, 100 );
			} );
			*/

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
			return this;
		}

		zproto.out = function( to, spd, from_x, from_y ) {
			var me = this,
					to = me.o.method.call( me, to || me.o.def_step, -1, function( v ) { return Math.max( v, me.o.min ); } )
			this.set_zoom( to, spd, from_x, from_y );
			return this;
		}

		zproto.pan = function( dx, dy ) {
			this.o.panx += dx;
			this.o.pany += dy;
			this.set_zoom( this.o.cur, -1 );
			return this;
		}

		zproto.panTo = function( x, y ) {
			this.set_pan( x, y );
			this.set_zoom( this.o.cur, -1 );
			return this;
		}

		zproto.set_pan = function( x, y ) {
			this.o.panx = x;
			this.o.pany = y;
			return this;
		}

		zproto.get_zoom = function() { return this.o.cur; }

		zproto.set_default_zoom = function( val ) {
			var val = val || this.o.cur;
			this.o.ui.setting( 'zoom', val );
			return this;
		};

		zproto.set_ele = function( ele ) {
			this.disallow_pan();
			this.o.ele = ele; //.attr( 'preserveAspectRatio', 'xMidYMid slice' );
			this.calc_view_port();
			this.allow_pan();
			return this;
		}

		zproto.calc_view_port = function() {
			var svg = $( this.o.ele.node ).closest( 'svg' ), w = qt.toFloat( svg.width() ), h = qt.toFloat( svg.height() ), dims = this.o.ui.e.canvas.data( 'dims' ) || { sx:1, sy:1, w:w, h:h, width:w, height:h };
			this.o.orig_height = dims.h;
			this.o.orig_width = dims.w;
			this.o.scaled_height = dims.height;
			this.o.scaled_width = dims.width;
			this.o.last_from_x = this.o.scaled_width / 2,
			this.o.last_from_y = this.o.scaled_height / 2,
			this.set_zoom( this.o.cur, -1 );
			return this;
		}

		zproto.current_center = function() {
			return { x:this.o.orig_width / 2, y:this.o.orig_height / 2 };
		}

		zproto.set_zoom = function( value, spd, from_x, from_y ) {
			if ( 'svg' == this.o.ele.type ) return;
			var from_c = { x:this.o.last_from_x, y:this.o.last_from_y };
			if ( ! qt.is( from_x ) || ! qt.is( from_y ) ) {
				var ul = { x:( ( this.o.scaled_width / value ) - this.o.scaled_width ) / -2, y:( ( this.o.scaled_height / value ) - this.o.scaled_height ) / -2 };
				from_c.x = ul.x + ( this.o.scaled_width / ( value * 2 ) );
				from_c.y = ul.y + ( this.o.scaled_height / ( value * 2 ) );
			}

			var spd = qt.toInt( spd ),
					from_x = qt.is( from_x ) ? from_x : from_c.x, //undefined, //( ( this.o.orig_width ) / 2 ),
					from_y = qt.is( from_y ) ? from_y : from_c.y; //undefined; //( ( this.o.orig_height ) / 2 );
			spd = spd ? spd : this.o.def_spd;

			if ( spd < 0 ) this.change( value, from_x, from_y );
			else this.animate( value, spd, from_x, from_y );
			return this;
		}

		zproto.change = function( value, from_x, from_y ) {
			var m = new S.Matrix();
			this.o.cur = value;
			m.translate( this.o.panx * value, this.o.pany * value ).scale( value, value, from_x, from_y );
			this.o.ele.transform( m );
			QS.cbs.trigger( 'zoom-pan-updated', [ this ] );
			return this;
		}

		zproto.animate = function( value, spd, from_x, from_y ) {
			var me = this,
					m = new S.Matrix();
			
			this.o.cur = value;
			m.translate( this.o.panx * value, this.o.pany * value ).scale( value, value, from_x, from_y );
			this.o.ele.stop().animate( { transform:m }, spd, mina.easein, function() { QS.cbs.trigger( 'zoom-pan-updated', [ me ] ); } );
			return this;
		}

		zproto.modes = {
			linear: function( amt, dir, sane ) { var dir = dir || 1, sane = sane || function( a ) { return a; }; return sane( this.o.cur + ( amt * dir ) ); },
			exponential: function( amt, dir, sane ) { var dir = dir || 1, sane = sane || function( a ) { return a; }, amt = amt || 1; return sane( dir > 0 ? this.o.cur * amt : this.o.cur / amt ); }
		};

		zproto.set_mode = function( mode ) {
			this.o.method = mode && qt.isF( this.modes[ mode ] ) ? this.modes[ mode ] : this.modes.linear;
			return this;
		}

		zproto.set_options = function( opts ) {
			this.o = $.extend( this.o, opts );
			return this;
		}

		function pan_mousedown( me, e ) {
			me.o.ele.addClass( 'panning' ).data( 'started', { x:e.pageX, y:e.pageY, px:me.o.panx, py:me.o.pany } );
		}
		function pan_mousemove( me, e ) {
			if ( ! me.o.ele.hasClass( 'panning' ) ) return;
			var from = me.o.ele.data( 'started' ),
					d = { x:( e.pageX - from.x ) * me.o.ui.e.canvas.data( 'dims' ).sx, y:( e.pageY - from.y ) * me.o.ui.e.canvas.data( 'dims' ).sy };
			me.panTo( ( d.x / me.o.cur ) + from.px, ( d.y / me.o.cur ) + from.py );
		}
		function pan_mouseup( me, e ) {
			me.o.ele.removeClass( 'panning' ).removeData( 'started' );
		}
		function pan_scroll( me, e ) {
		}

		function _svg( ele ) {
			if ( ! qt.is( ele ) ) return;
			var svg = $( ele.node ).parents( 'svg:last' );
			return ( svg.length ) ? svg.get( 0 ) : ele.node;
		}

		zproto.allow_pan = function() {
			$( window ).off( 'scroll.cap' ).on( 'scroll.cap', function() { var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_scroll.apply( this, args ); } );
			var me = this, svg = _svg( me.o.ele ), down = false;

			$( svg ).on( 'mousedown.zpan', function( e ) { down = true; } ),
			$( window ).on( 'mouseup.zpan', function( e ) { if ( down ) { down = false; var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_mouseup.apply( this, args ); } } ),
			$( window ).on( 'mousedown.zpan', function( e ) { if ( down ) { var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_mousedown.apply( this, args ); } } ),
			$( window ).on( 'mousemove.zpan', function( e ) { if ( down ) { var args = [].slice.call( arguments, 0 ); args.unshift( me ); pan_mousemove.apply( this, args ); } } )
			return this;
		}

		zproto.disallow_pan = function() {
			var me = this, svg = _svg( me.o.ele );
			$( svg ).off( '.zpan' );
			$( window ).off( '.zpan' );
			return this;
		}

		zoomer.prototype = zproto;

		QS.cbs.add( 'canvas-start', function( paper, ui ) {
			if ( ! qt.isO( paper.zoom ) ) {
				var initial_zoom = qt.is( ui.bgimg ) && qt.is( ui.bgimg._dims ) ? ui.bgimg._dims.scale : 1;
				paper.zoom = new zoomer( ui.shp, { def_step:2, max:25, min:0.125, cur:initial_zoom, def_method:'exponential', ui:ui } );
			}
		} );

		QS.cbs.add( 'create-btns', function( t ) {
			var r = t.utils.add_btn( {
				ele: t.utils.hud.path( 'M6,0L9,0L9,6L15,6L15,9L9,9L9,15L6,15L6,9L0,9L0,6L6,6z' ),
				only_click: true,
				name: 'zoom-in',
				title: 'Zoom-In',
				click: function() { t.c.zoom.in(); }
			} );

			t.utils.add_btn( {
				ele: t.utils.hud.path( 'M0,0L15,0L15,4L0,4z' ),
				only_click: true,
				name: 'zoom-out',
				title: 'Zoom-Out',
				click: function() { t.c.zoom.out(); }
			} );

			var outer = t.utils.hud.path( 'M0,0L21,0L21,21L0,21z' ).attr( { style:'fill:transparent; stroke:#999;' } ),
					box = t.utils.hud.path( 'M3,3L18,3L18,18L3,18L3,3z' ).attr( { style:'fill:#efefef;' } ),
					arrows = t.utils.hud.path( 'M3,3L7,3L10.5,0L13,3L18,3L18,7L21,10.5L18,13L18,18L13,18L10.5,21L7,18L3,18L3,13L0,10.5L3,7z' ).attr( { style:'fill:#777;' } ),
					g = t.utils.hud.g( outer, arrows, box );
			t.utils.add_btn( {
				ele: g,
				only_click: true,
				name: 'reset-zoom',
				title: 'Reset Zoom',
				click: function() { t.c.zoom.calc_view_port().set_pan( 0, 0 ).set_zoom( 1 ); }
			} );

/* needs to be re-thoguht
			t.utils.add_btn( {
				ele: t.utils.hud.path( 'M0,0L6,0L4,2L8,6L11,6L15,2L13,0L19,0L19,6L17,4L13,8L13,11L17,15L19,13L19,19L13,19L15,17L11,13L8,13L4,17L6,19L0,19L0,13L2,15L6,11L6,8L2,4L0,6z' ),
				only_click: true,
				name: 'fullscreen',
				title: 'Distraction Free',
				click: function() {
					$( 'body' )[ ( $( 'body' ).hasClass( 'distraction-free' ) ) ? 'removeClass' : 'addClass' ]( 'distraction-free' );
					$( window ).trigger( 'resize' );
				}
			} );
*/
		} );
	} );

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
				} else if ( ( ( qt.isS( cmd ) && qt.is( p[ cmd ] ) ) || ( qt.isO( cmd ) && ! qt.isC( cmd, QS.svguiC ) ) ) ) {
					args.unshift( cmd );
					return _update_p.apply( t, args );
				} else if ( qt.isC( cmd, QS.svguiC ) || qt.isC( t.ui, QS.svguiC ) ) {
					_update_p.apply( t, args );
					t.ui = cmd;
					var off = t.ui.e.main.offset();
					t.e.hud = $( '<svg id="' + p.id + '" class="' + ( qt.isA( p.cls ) ? p.cls.join( ' ' ) : p.cls ) + '"></svg>' ).appendTo( t.ui.e.main );
					_allow_drag( t.e.hud, {
						by: '.ui-hndl',
						inside: t.ui.e.main,
						snap: true
					} );
					t.hud = S( t.e.hud.get( 0 ) );
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
					btn.ele = hud.g( wrap, btn.ele ).data( { item:btn } ).attr( { title:btn.title } ).addClass( 'ui-btn' ).click( function() { _make_active( btn ); } );
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

	QS.svgui = ( function() {
		var defs = {
			nonce: '',
			edata: {},
			ajaxurl: '/wp-admin/admin-ajax.php',
			templates: {},
			messages: {},
			owns: {}
		};

		function _adjust_zoom_zones( zoomer ) {
			var lvl = zoomer.o.cur;
			$( '[zoom-lvl]', zoomer.o.ui.e.main ).each( function() {
				if ( qt.toFloat( $( this ).attr( 'zoom-lvl' ) ) >= lvl ) {
					$( this ).css( { visibility:'visible' } );
				} else {
					$( this ).css( { visibility:'hidden' } );
				}
			} );
		}
		QS.cbs.add( 'zoom-pan-updated', _adjust_zoom_zones );

		function _organize_zones() {
			var ordered = [], zzones = [], me = this, i;
			Object.keys( me.o.edata.zones ).forEach( function( k ) { ordered.push( me.o.edata.zones[ k ] ); } );
			ordered.sort( function( a, b ) { var am = qt.toInt( a.meta._order || 0 ), bm = qt.toInt( b.meta._order || 0 ); return am - bm; } );

			for ( i = 0; i < ordered.length; i++ ) {
				var z = ordered[ i ];
				if ( ! me.bgimg && qt.is( z.meta ) && qt.is( z.meta._type ) && 'image' == z.meta._type && qt.is( z.meta.bg ) && qt.toInt( z.meta.bg ) ) {
					me.bgimg = z;
					_get_dims( me.bgimg, this.e.main );
					break;
				}
			}

			me.o.edata.indexed_zones = me.o.edata.zones;
			me.o.edata.zones = ordered;

			Object.keys( me.o.edata.zzones ).forEach( function( k ) { zzones.push( me.o.edata.zzones[ k ] ); } );
			me.o.edata.zzones = zzones;
		}

		function _maybe_meta( meta, k, def ) {
			return ( qt.is( meta[ k ] ) ) ? meta[ k ] : def;
		}

		function _fix_zone_abbr( abbr ) {
			if ( abbr && ! isNaN( parseInt( abbr.charAt(0), 10 ) ) )
				abbr = 'Z' + abbr;
			return abbr;
		}

		function _draw_zones() {
			var me = this, styles = [], i, j;

			if ( qt.isA( this.o.edata.zones ) ) {
				for ( i = 0; i < this.o.edata.zones.length; i++ ) {
					var z = this.o.edata.zones[ i ];
					if ( qt.is( z.meta ) && qt.is( z.meta._subtype ) ) {
						QS.cbs.trigger( 'draw-zone-' + z.meta._subtype, [ z, this.c, this.zones, function() { me.with_drawn_zone.apply( me, [].slice.call( arguments ) ); } ] );
						// make stylesheet entries for this zone, since css is faster in most browsers than js alters
						styles.push( '#' + _fix_zone_abbr( z.abbr ) + ' { fill:' + _maybe_meta( z.meta, 'fill', '#000' ) + '; fill-opacity:' + _maybe_meta( z.meta, 'fill-opacity', '1' )
								+ '; stroke:1px; stroke-dasharray:1,0; stroke-color:' + _maybe_meta( z.meta, 'fill', '#000' ) + '; stroke-opacity:' + _maybe_meta( z.meta, 'fill-opacity', '1' )
							+ ' }' );
						styles.push( '#' + _fix_zone_abbr( z.abbr ) + ':hover, #' + _fix_zone_abbr( z.abbr ) + ':active { stroke-width:1px; stroke:#000; stroke-dasharray:6,6; }' );
						styles.push( '#' + _fix_zone_abbr( z.abbr ) + '.unavail, #' + _fix_zone_abbr( z.abbr ) + '.unavail:hover, #' + _fix_zone_abbr( z.abbr ) + '.unavail:active { '
								+ 'fill:' + _maybe_meta( z.meta, 'unavail-fill', '#bbb' ) + '; fill-opacity:' + _maybe_meta( z.meta, 'unavail-fill-opacity', '1' ) + '; '
								+ ' stroke:1px; stroke-dasharray:1,0; stroke-color:' + _maybe_meta( z.meta, 'unavail-fill', '#000' ) + '; stroke-opacity:' + _maybe_meta( z.meta, 'unavail-fill-opacity', '1' )
							+ '}' );
					}
				}
			}


			if ( qt.isO( me.o.owns ) ) {
				for ( i in me.o.owns ) {
					if ( me.o.owns[ has ]( i ) && qt.isA( me.o.owns[ i ] ) ) {
						for ( j = 0; j < me.o.owns[ i ].length; j++ ) {
							if ( qt.is( me.o.owns[ i ][ j ].z ) && qt.is( me.o.edata.indexed_zones[ me.o.owns[ i ][ j ].z ] ) && me.o.edata.indexed_zones[ me.o.owns[ i ][ j ].z ]._ele ) {
								me.o.edata.indexed_zones[ me.o.owns[ i ][ j ].z ]._ele.addClass( 'selected' );
							}
						}
					}
				}
			}

			styles.push( '#svgui .zone.selected, #svgui .zone.unavail.selected { stroke-width:1px; stroke:#000; stroke-dasharray:1,0; }' );
			var ss = $( 'style#svgui-style' );
			if ( 0 == ss.length ) ss = $( '<style type="text/css" id="svgui-style"></style>' ).appendTo( 'head' );
			ss.text( styles.join( ' ' ) );
		}

		function _draw_zzones() {
			var me = this;
			if ( qt.isA( this.o.edata.zzones ) )
				for ( var i = 0; i < this.o.edata.zzones.length; i++ )
					if ( qt.is( this.o.edata.zzones[ i ].meta ) && qt.is( this.o.edata.zzones[ i ].meta._subtype ) )
						QS.cbs.trigger( 'draw-zone-' + this.o.edata.zzones[ i ].meta._subtype, [ this.o.edata.zzones[ i ], this.c, this.zoom_zones, function() { me.with_drawn_zone.apply( me, [].slice.call( arguments ) ); } ] );
		}

		function _get_dims( bgimg, container, with_dims ) {
			var res = { w:0, h:0, r:1, scale:1, sx:1, sy:1 }, with_dims = qt.isF( with_dims ) ? with_dims : function() {};

			if ( qt.is( bgimg ) && qt.is( bgimg.meta ) && qt.is( bgimg.meta.src ) ) {
				if ( qt.is( bgimg.meta ) && qt.is( bgimg.meta.width ) && qt.is( bgimg.meta.height ) && bgimg.meta.height > 0 ) {
					res.r = bgimg.meta.width / bgimg.meta.height;
					res.w = container.width();
					res.h = res.w / res.r;
					res.width = bgimg.meta.width;
					res.height = bgimg.meta.height;
					res.scale = res.w / res.width;
					res.sx = res.w > 0 ? res.width / res.w : 1;
					res.sy = res.h > 0 ? res.height / res.h : 1;
					with_dims( res );
				} else {
					var img = new Image();
					img.onload = function() {
						bgimg.meta.width = img.width;
						bgimg.meta.height = img.height;
						_get_dims( bgimg, container, with_dims );
					};
					img.src = src;
				}
			} else {
				res.h = res.w = res.height = res.width = container.width();
				with_dims( res );
			}
		}

		var protect = '', initial_zoom = false;
		function _on_resize( e ) {
			var me = this, now = ( Math.random() * 100000 ) + '-' + ( Math.random() * 10000000 );
			protect = now;
			setTimeout( function() {
				if ( protect !== now ) return;
				_get_dims( me.bgimg, me.e.cont, function( dims ) {
					me.e.canvas.data( 'dims', dims )[0].setAttribute( 'viewBox', '0 0 ' + dims.width + ' ' + dims.height );
					if ( ! $( 'body' ).hasClass( 'distraction-free' ) )
						me.e.main.css( { width:dims.w, height:dims.h } );
					me.c.zoom.calc_view_port();
					/*
					if ( ! initial_zoom && qt.isO( me.zoom ) ) {
						initial_zoom = true;
						me.c.zoom.set_zoom( dims.scale, -1, 0, 0 );
					} else if ( qt.isO( me.c.zoom ) ) {
						me.c.zoom.set_zoom( dims.scale, -1, 0, 0 );
					}
					*/
				} );
			}, 50 );
		}

		function _create_tooltip() {
			var html = this.tmpl( 'zone-info-tooltip' );
			if ( ! html ) return;

			this.tooltip = $( html ).appendTo( 'body' );
		}

		function _smart_position( preferred, shower, ele, off ) {
			var windims = { w:$( window ).width(), h:$( window ).height() }, off = qt.is( off ) ? qt.toInt( off ) : 10, cur = shower.css( 'display' );
			if ( 'block' != cur ) shower.show();
			var dims = { w:ele.outerWidth(), h:ele.outerHeight() };
			if ( 'block' != cur ) shower.hide();

			if ( windims.w < preferred.left + dims.w + off + off )
				preferred.left = Math.max( off, windims.w - ( dims.w + off ) );

			if ( windims.h < preferred.top + dims.h + off + off )
				preferred.top = Math.max( off, windims.wh- ( dims.h + off ) );

			return preferred;
		}

		function _update_from_stati( zone_ids ) {
			var me = this, zone_ids = qt.isA( zone_ids ) ? zone_ids : [ zone_ids ], i, z;
			for ( i = 0; i < zone_ids.length; i++ ) {
				z = me.o.edata.indexed_zones[ zone_ids[ i ] + '' ];
				if ( qt.is( z._ele ) ) {
					if ( qt.is( me.o.edata.stati[ zone_ids[ i ] + '' ] ) && me.o.edata.stati[ zone_ids[ i ] + '' ] <= 0 ) {
						z._ele.addClass( 'unavail' );
					} else {
						z._ele.removeClass( 'unavail' );
					}
				}
			}
		}

		function ui( ele, o ) {
			this.constructor = ui;
			this.e = { main:ele };
			this.o = $.extend( true, {}, defs, o );

			this.init();
		}

		ui.prototype = {
			reinit: function( ele, o ) {
				var i;
				if ( qt.isO( this.o.edata ) && qt.is( this.o.edata.zones ) )
					for ( i in this.o.edata.zones )
						if ( qt.is( this.o.edata.zones[ i ]._ele ) )
							this.o.edata.zones[ i ]._ele.remove();
				delete this.o;

				for ( i in this.e )
					if ( 'main' != i && 'cont' != i )
						$( this.e[ i ] ).remove();
				delete this.e;

				this.e = { main:ele };
				this.o = $.extend( true, {}, defs, o );
				this.init();
			},

			init: function() {
				if ( qt.is( this.o.edata.zones ) )
					_organize_zones.call( this );

				this._setup_elements();
				this._setup_events();

				QS.cbs.add( 'canvas-start', function() { $( window ).trigger( 'resize' ); } )( 10000 );
				QS.cbs.trigger( 'canvas-start', [ this.c, this ] );

				QS.cbs.trigger( 'create-btns', [ this ] )
			},

			msg: function( str ) {
				var args = [].slice.call( arguments, 1 ), i;
				if ( qt.is( this.o.messages[ str ] ) )
					str = this.o.messages[ str ];
				for ( i = 0; i < args.length; i++ )
					str = str.replace( /%s/, args[ i ] );
				return str;
			},

			tmpl: function( name ) {
				return qt.is( this.o.templates[ name ] ) ? this.o.templates[ name ] : '';
			},

			reserve_resp: function( r, req, resui ) {
				var me = this, to_update = [], ritem, z;
				if ( ! r || ! qt.isA( r.r ) || ! r.r.length )
					return;

				for ( var i = 0; i < r.r.length; i++ ) {
					ritem = r.r[ i ];
					z = me.o.edata.indexed_zones[ ritem.z + '' ];
					to_update.push( ritem.z );
					me.o.edata.stati[ ritem.z + '' ] = ritem.c;
					z._ele.addClass( 'selected ' + ( ritem.c <= 0 ? 'unavail' : '' ) );
				}

				_update_from_stati.call( me, to_update );
			},

			interest_resp: function( r, req, resui ) {
				var me = this, to_update = [];
				if ( ! r || ! qt.isA( r.r ) || ! r.r.length )
					return;

				var data = { items:[] }, prices = qt.isO( this.o.edata.ps ) ? this.o.edata.ps : { '0':[] }, auto_reserve = true, i;
				for ( i = 0; i < r.r.length; i++ ) {
					var ritem = r.r[ i ];
					if ( ! ritem.s ) {
						auto_reserve = false;
						break;
					}
					
					var price_cnt = qt.is( prices[ ritem.z + '' ] ) ? prices[ ritem.z + '' ].length : prices['0'].length, z = me.o.edata.indexed_zones[ ritem.z + '' ],
							p = qt.is( prices[ ritem.z + '' ] ) ? prices[ ritem.z + '' ][0].product_id : prices['0'][0].product_id;
					data.items.push( { zone:ritem.z, 'ticket-type':p, quantity:ritem.q } );

					if ( !( 1 == ritem.c && 1 == price_cnt ) ) {
						auto_reserve = false;
					}

					to_update.push( ritem.z );
					me.o.edata.stati[ ritem.z + '' ] = ritem.c - ritem.q;
					z._ele.addClass( 'selected ' + ( ritem.c - ritem.q <= 0 ? 'unavail' : '' ) );
				}

				_update_from_stati.call( me, to_update );

				if ( auto_reserve && data.items.length ) {
					me.o.resui.reserve( data );
				} else {
					me.o.resui.price_selection( data.items, function( selected_price, qty, after_resp ) {
						var i;
						for ( i = 0; i < data.items.length; i++ ) {
							data.items[ i ]['ticket-type'] = selected_price;
							data.items[ i ]['quantity'] = qty;
						}
						me.o.resui.reserve( data );
					} );
				}
			},

			remove_assoc: function( r, req, resui ) {
				if ( ! qt.isA( r.r ) || ! r.r.length ) return;

				var me = this, to_update = [], i;
				for ( i = 0; i < r.r.length; i++ ) {
					var z = me.o.edata.indexed_zones[ r.r[ i ].z ];
					if ( r.s ) {
						if ( 0 == me.o.resui.e.owns.find( '[key^="' + r.r[ i ].z + ':"]' ).length )
							z._ele.removeClass( 'selected' );
						if ( r.r[ i ].c > 0 )
							z._ele.removeClass( 'unavail' );
					}
					to_update.push( r.r[ i ].z );
					me.o.edata.stati[ r.r[ i ].z + '' ] = r.r[ i ].c;
				}

				_update_from_stati.call( me, to_update );
			},

			_setup_events: function() {
				var me = this, shown = false;

				$( window ).on( 'resize', function( e ) { _on_resize.call( me, e ) } );

				function removed_res_int( r ) { me.remove_assoc( r ); }
				QS.cbs.remove( 'removed-res-int-raw', removed_res_int );
				QS.cbs.add( 'removed-res-int-raw', removed_res_int );

				function added_reserve() { me.reserve_resp.apply( me, [].slice.call( arguments ) ); }
				QS.cbs.remove( 'added-reserve', added_reserve );
				QS.cbs.add( 'added-reserve', added_reserve );

				function added_interest() { me.interest_resp.apply( me, [].slice.call( arguments ) ); }
				QS.cbs.remove( 'added-interest', added_interest );
				QS.cbs.add( 'added-interest', added_interest );

				var start = { x:0, y:0 }, thresh = 10, off = { x:10, y:10 };
				$( this.shp.node ).off( 'mousedown.zone', '.zone' ).on( 'mousedown.zone', '.zone', function( e ) {
					start.x = e.pageX;
					start.y = e.pageY;
				} ).off( 'click.zone', '.zone' ).on( 'click.zone', '.zone', function( e ) {
					if ( Math.abs( e.pageX - start.x ) > thresh || Math.abs( e.pageY - start.y ) ) return;
					var ele = $( this );
					if ( ele.hasClass( 'unavail' ) ) return;
					var z = ele.data( 'zone' ), data = { items:[ { zone:z.id } ] };
					me.o.resui.interest( data );
				} ).off( 'mouseover.zone', '.zone' ).on( 'mouseover.zone', '.zone', function( e ) {
					var zone = $( this ).data( 'zone' );
					if ( ! qt.is( zone ) ) return;

					if ( ! qt.is( me.tooltip ) ) _create_tooltip.call( me );
					if ( ! qt.isO( me.tooltip ) || 0 == me.tooltip.length ) return;

					var avail = me.o.edata.stati[ zone.id ],
							status_msg = me.msg( avail > 0 ? ( avail > 1 ? 'Available (%s)' : 'Available' ) : 'Unavailable', avail ),
							pos = { top:e.pageY + off.y, left:e.pageX + off.x };

					me.tooltip.find( '.zone-name' ).text( zone.name );
					me.tooltip.find( '.status-msg' ).text( status_msg );
					me.tooltip.find( '.tooltip-positioner' ).css( _smart_position( pos, me.tooltip, me.tooltip.find( '.tooltip-wrap' ) ) );
					me.tooltip.finish().fadeIn( 200 );
					shown = true;
				} ).off( 'mousemove.zone', 'zone' ).on( 'mousemove.zone', '.zone', function( e ) {
					if ( ! shown ) return;
					me.tooltip.find( '.tooltip-positioner' ).css( _smart_position( { top:e.pageY + off.y, left:e.pageX + off.x }, me.tooltip, me.tooltip.find( '.tooltip-wrap' ) ) );
				} ).off( 'mouseout.zone', '.zone' ).on( 'mouseout.zone', '.zone', function( e ) {
					if ( ! qt.isO( me.tooltip ) || 0 == me.tooltip.length ) return;
					me.tooltip.fadeOut( 100 );
					shown = false;
				} );

				$( me.shp.node ).off( 'click.zzone', '.zoom-zone' ).on( 'click.zzone', '.zoom-zone', function( e ) {
					var $el = $( this ),
							zone = $el.data( 'zone' )._ele,
							w = qt.toFloat( zone.attr( 'width' ) ),
							h = qt.toFloat( zone.attr( 'height' ) ),
							zm = ( zone.matrix || new S.Matrix ).split(),
							x = qt.toFloat( zone.attr( 'x' ) ) + zm.dx,
							y = qt.toFloat( zone.attr( 'y' ) ) + zm.dy,
							mw = me.e.main.width(),
							mh = me.e.main.height(),
							dims = me.e.canvas.data( 'dims' ) || { width:mw, height:mh, w:mw, h:mh },
							scalex = dims.sx * ( w > 0 ? mw / w : 1 ),
							scaley = dims.sy * ( h > 0 ? mh / h : 1 ),
							scale = Math.min( scalex, scaley ),
							ul = { x:( ( dims.width / scale ) - dims.width ) / -2, y:( ( dims.height / scale ) - dims.height ) / -2, w:dims.width / scale, h:dims.height / scale },
							cx = -( x - ul.x ),
							cy = -( y - ul.y );
					me.c.zoom.panTo( cx, cy ).set_zoom( scale, 0 );
				} );
			},

			_setup_elements: function() {
				this.e.main.empty();
				this.e.cont = this.e.main.closest( '.qsot-event-area-ticket-selection' );
				this.e.canvas = $( '<svg id="svgui"></svg>' ).appendTo( this.e.main );
				this.c = S( this.e.canvas.get( 0 ) );

				this.shp = this.c.g().attr( { id:'shapes' } );
				this.zones = this.c.g().attr( { id:'zones' } ).appendTo( this.shp );
				this.zoom_zones = this.c.g().attr( { id:'zoom-zones' } ).hide().appendTo( this.shp );

				this.utils = new QS.Buttonbar( this, { x:0, y:30, snap:'top right', id:'qsot-utils' } );

				var p = this.c.g();
				this.c.rect( 0, 0, 10, 10 ).attr( { fill:'#000', stroke:'transparent', 'fill-opacity':0.2 } ).appendTo( p );
				this.c.path( 'M0,0L10,10' ).attr( { fill:'transparent', stroke:'#000' } ).appendTo( p );
				p = p.toPattern( 0, 0, 10, 10 ).attr( { id:( p.id = 'slash-lines' ) } );

				_draw_zones.call( this );
				_draw_zzones.call( this );
			},

			with_drawn_zone: function( ele, zone ) {
				zone._ele = ele;
				$( ele.node ).data( 'zone', zone );
				if ( 'zoom-zone' == zone.meta._subtype || ( 'image' == zone.meta._subtype && qt.is( zone.meta.bg ) ) || 1 == qt.toInt( zone.meta.bg ) ) {
					// nothing
				} else {
					ele.addClass( 'zone' );
					if ( ! qt.is( this.o.edata.stati[ zone['id'] ] ) || this.o.edata.stati[ zone['id'] ] <= 0 ) {
						ele.addClass( 'unavail' );
					}
				}
			}
		};

		function start_ui( ele, o ) {
			return new ui( ele, o );
		}

		function draw_ellipse( zdata, canvas, par, with_new ) {
			var a = zdata.meta,
					x = qt.is( a.cx ) ? a.cx : 0,
					y = qt.is( a.cy ) ? a.cy : 0,
					atts = {
						//fill: qt.is( zdata.meta.fill ) ? $.Color( zdata.meta.fill ).toString() : '#000000',
						//'fill-opacity': zdata.meta[ 'fill-opacity' ] || 1,
						id: _fix_zone_abbr( zdata.abbr ),
						zone: zdata.name
					},
					rx = qt.is( zdata.meta.rx ) ? zdata.meta.rx : ( qt.is( zdata.meta.r ) ? zdata.meta.r : 1 ),
					ry = qt.is( zdata.meta.ry ) ? zdata.meta.ry : ( qt.is( zdata.meta.r ) ? zdata.meta.r : 1 ),
					m = ( new S.Matrix ).translate( x, y ).rotate( qt.toFloat( zdata.meta.angle || 0 ) ),
					z = canvas.ellipse( 0, 0, rx, ry ).attr( atts ).transform( m ).appendTo( par );
			with_new( z, zdata );
		}
		QS.cbs.add( 'draw-zone-circle', draw_ellipse );
		QS.cbs.add( 'draw-zone-ellipse', draw_ellipse );

		function draw_rect( zdata, canvas, par, with_new ) {
			var a = zdata.meta,
					x = qt.is( a.x ) ? a.x : 0,
					y = qt.is( a.y ) ? a.y : 0,
					atts = {
						//fill: qt.is( zdata.meta.fill ) ? $.Color( zdata.meta.fill ).toString() : '#000000',
						//'fill-opacity': zdata.meta[ 'fill-opacity' ] || 1,
						id: _fix_zone_abbr( zdata.abbr ),
						zone: zdata.name
					},
					m = ( new S.Matrix ).translate( x, y ).rotate( qt.toFloat( zdata.meta.angle || 0 ) ),
					z = canvas.rect( 0, 0, zdata.meta.width, zdata.meta.height ).attr( atts ).transform( m ).appendTo( par );
			with_new( z, zdata );
		}
		QS.cbs.add( 'draw-zone-square', draw_rect );
		QS.cbs.add( 'draw-zone-rectangle', draw_rect );

		function draw_image( zdata, canvas, par, with_new ) {
			var a = zdata.meta,
					x = qt.is( a.x ) ? a.x : 0,
					y = qt.is( a.y ) ? a.y : 0,
					atts = {
						//fill: qt.is( zdata.meta.fill ) ? $.Color( zdata.meta.fill ).toString() : '#000000',
						//'fill-opacity': zdata.meta[ 'fill-opacity' ] || 1,
						id: _fix_zone_abbr( zdata.abbr ),
						zone: zdata.name
					},
					m = ( new S.Matrix ).translate( x, y ).rotate( qt.toFloat( zdata.meta.angle || 0 ) ),
					z = canvas.image( a.src, 0, 0, zdata.meta.width, zdata.meta.height ).attr( atts ).transform( m ).appendTo( par );
			with_new( z, zdata );
		}
		QS.cbs.add( 'draw-zone-image', draw_image );

		function draw_zz( zdata, canvas, par, with_new ) {
			var a = zdata.meta,
					x = qt.is( a.x ) ? a.x : 0,
					y = qt.is( a.y ) ? a.y : 0,
					atts = {
						fill: qt.is( zdata.meta.fill ) && zdata.meta.fill ? ( zdata.meta.fill.match( /url/ ) ? zdata.meta.fill : $.Color( zdata.meta.fill ).toString() ) : 'url(#slash-lines)',
						'fill-opacity': zdata.meta[ 'fill-opacity' ] || 1,
						id: zdata.abbr,
						'zoom-lvl': zdata.meta[ 'zoom_level' ] || 1.1,
						zone: zdata.name
					},
					m = ( new S.Matrix ).translate( x, y ).rotate( qt.toFloat( zdata.meta.angle || 0 ) );
			var z = canvas.rect( 0, 0, zdata.meta.width, zdata.meta.height ).addClass( 'zoom-zone' ).attr( atts ).transform( m ).appendTo( par );
			with_new( z, zdata );
		}
		QS.cbs.add( 'draw-zone-zoom-zone', draw_zz );

		QS.svguiC = ui;

		return start_ui;
	} )();
} )( jQuery, Snap, QS.Tools );
