( function( $, qt ) {
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

	QS.Prompt = ( function() {
		var defs = {
					with_result: function() {},
					def: '',
					title: 'Question:',
					helper: '',
					msg: 'Are you sure?'
				},
				dia, msg, qstn, hlpr, inp;

		return function( o ) {
			// if there is not yet a dialog, make one
			if ( ! qt.is( dia ) ) {
				dia = $( '<div class="dia-inner qsot-prompt"></div>' ).appendTo( 'body' ).dialog( {
					modal: true,
					autoOpen: false,
					width: 500,
					maxWidth: '100%',
					closeOnEscape: true,
					buttons: [
						{
							text: 'OK',
							click: function( e ) { dia.dialog( 'close' ); dia.trigger( 'handleresp', [ true ] ); }
						},
						{
							text: 'cancel',
							click: function( e ) { dia.dialog( 'close' ); dia.trigger( 'handleresp', [ false ] ); }
						}
					],
					open: function( e, ui ) {
						var me = $( this );
						_on_keyup( '27 s27 c27 a27', function() { dia.dialog( 'close' ); dia.trigger( 'handleresp', [ false ] ); } );
						_on_keyup( '13 s13 c13 a13', function() { dia.dialog( 'close' ); dia.trigger( 'handleresp', [ true ] ); } );
					},
					close: function( e, ui ) {
						var me = $( this );
						_off_keyup( '27 s27 c27 a27' );
						_off_keyup( '13 s13 c13 a13' );
					}
				} );
				msg = $( '<div class="dia-message" rel="msg"></div>' ).appendTo( dia );
				qstn = $( '<div class="question" rel="question"></div>' ).appendTo( msg );
				hlpr = $( '<div class="helper" rel="question"></div>' ).appendTo( msg );
				inp = $( '<input type="text" class="widefat" value="" rel="result"/>' ).appendTo( dia ).on( 'keyup.qsprompt', function( e ) {
					switch ( e.which ) {
						case 27: dia.dialog( 'close' ); dia.trigger( 'handleresp', [ false ] ); break;
						case 13: dia.dialog( 'close' ); dia.trigger( 'handleresp', [ true ] ); break;
					}
				} );
			}

			// normalize the options
			var options = $.extend( {}, defs, o );

			// update the message and default value
			dia.dialog( 'option', 'title', options.title );
			qstn.html( options.msg );
			hlpr.html( options.helper );
			inp.val( options.def );

			// setup close func call and open dialog
			dia.off( 'handleresp.qsprompt' ).on( 'handleresp.qsprompt', function( e, success ) {
				var success = success || false, value = null;
				if ( success )
					value = dia.find( '[rel="result"]' ).val();
				if ( qt.isF( options.with_result ) )
					options.with_result( value );
			} ).dialog( 'open' );

			console.log( 'dialog', dia, msg, inp );
		};
	} )();

	QS.Tooltip = ( function() {
		var defs = {
					frmt: '<div class="qsot-tooltip"><div class="tooltip-positioner"><div class="tooltip-wrap"></div></div></div>',
					parent: 'body',
					offx: 10,
					offy: 10
				},
				def_hndlrs = {
					mouseover: function( e ) {},
					mousemove: function( e ) {},
					mouseout: function( e ) {}
				},
				shown = false;

		function _setup_tip() {
			var found = $( '#qsot-tooltip', this.o.parent );
			if ( ! found.length ) 
				found = $( this.o.frmt ).appendTo( this.o.parent );
			this.e.tooltip = found;
			this.e.msg = $( '.tooltip-wrap', this.e.tooltip );
			this.e.parent = $( this.o.parent );
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

		function _mouseover( e, tip ) {
			var data = $( this ).data( 'tooltip' ) || $( this ).attr( 'data-tooltip' ),
					pos = { top:e.pageY + tip.o.offy, left:e.pageX + tip.o.offx };
			data = data || $( this ).attr( 'title' );
			if ( data && data.length ) {
				tip.e.msg.text( data );
				tip.e.tooltip.find( '.tooltip-positioner' ).css( _smart_position( pos, tip.e.tooltip, tip.e.tooltip.find( '.tooltip-wrap' ) ) );
				tip.e.tooltip.finish().fadeIn( 200 );
				shown = true;
			}
		}

		function _mousemove( e, tip ) {
			if ( ! shown ) return;
			tip.e.tooltip.find( '.tooltip-positioner' ).css( _smart_position( { top:e.pageY + tip.o.offy, left:e.pageX + tip.o.offx }, tip.e.tooltip, tip.e.tooltip.find( '.tooltip-wrap' ) ) );
		}

		function _mouseout( e, tip ) {
			if ( ! qt.isO( tip.e.tooltip ) || 0 == tip.e.tooltip.length ) return;
			tip.e.tooltip.fadeOut( 100 );
			shown = false;
		}

		function tt( o ) {
			this.o = $.extend( {}, defs, o );
			this.e = {};

			this.init();
		}

		tt.prototype = {
			init: function() {
				_setup_tip.call( this );
			},

			attachTo: function( sel, handlers, del ) {
				var me = this, del = del || $( document ), handlers = $.extend( {}, def_hndlrs, handlers );
				if ( qt.isO( sel ) ) {
					$( sel )
						.off( 'mouseover.qstt' ).on( 'mouseover.qstt', function( e ) { e.preventDefault(); _mouseover.call( this, e, me ); handlers.mouseover.call( this, e, me ); } )
						.off( 'mousemove.qstt' ).on( 'mousemove.qstt', function( e ) { e.preventDefault(); _mousemove.call( this, e, me ); handlers.mousemove.call( this, e, me ); } )
						.off( 'mouseout.qstt' ).on( 'mouseout.qstt', function( e ) { e.preventDefault(); _mouseout.call( this, e, me ); handlers.mouseout.call( this, e, me ); } );
				} else {
					$( del )
						.off( 'mouseenter.qstt', sel ).on( 'mouseenter.qstt', sel, function( e ) { e.preventDefault(); _mouseover.call( this, e, me ); handlers.mouseover.call( this, e, me ); } )
						.off( 'mousemove.qstt', sel ).on( 'mousemove.qstt', sel, function( e ) { e.preventDefault(); _mousemove.call( this, e, me ); handlers.mousemove.call( this, e, me ); } )
						.off( 'mouseleave.qstt', sel ).on( 'mouseleave.qstt', sel, function( e ) { e.preventDefault(); _mouseout.call( this, e, me ); handlers.mouseout.call( this, e, me ); } );
				}
			},

			getTip: function() { return this.e.tooltip; }
		};

		return tt;
	} )();
} )( jQuery, QS.Tools );
