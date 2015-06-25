( function( $, qt ) {
	var S = _qsot_price_struct || {}, defs = {}, has = 'hasOwnProperty';
	console.log( 'PRICING', S );

	function _str( name ) {
		return qt.isO( S.strings ) && qt.isS( S.strings[ name ] ) ? S.strings[ name ] : name;
	}

	function pui( el, o ) {
		var me = this;
		me.ind = -1;
		me.e = { main:$( el ) };
		me.o = $.extend( {}, defs, o );

		function _edit_struct( option ) {
			var cur = option.text(), id = option.val(), name = prompt( _str( 'change_name' ).replace( /%s/, cur ), cur );

			if ( qt.isS( name ) && ( name = $.trim( name ) ) ) {
				S.data.structs[ id ].name = name;
				_fill_elements();
				me.e.structs_list.val( id );
				me.e.structs_list.trigger( 'chosen:updated' ).trigger( 'change' );
			}
		}

		function _new_struct() {
			var name = prompt( _str( 'what_name' ) );

			if ( qt.isS( name ) && ( name = $.trim( name ) ) ) {
				var key = ( me.ind-- ) + '';
				S.data.structs[ key ] = { id:key, name:name, prices:{ '0':[] } };
				_fill_elements();
				me.e.structs_list.val( key );
				me.e.structs_list.trigger( 'chosen:updated' );
			}
		}

		function _load_struct( struct_id ) {
			if ( qt.is( S.data.structs[ struct_id + '' ] ) )
				me.e.tickets_list.val( S.data.structs[ struct_id + '' ].prices['0'] ).trigger( 'chosen:updated' );
		}

		function _update_struct( struct_id, val ) {
			if ( ! qt.is( S.data.structs[ struct_id + '' ] ) ) S.data.structs[ struct_id + '' ] = { '0':[] };
			S.data.structs[ struct_id ].prices['0'] = val;
			console.log( 'UPDATED', struct_id, val, S.data.structs[ struct_id ].prices );
		}

		function _setup_elements() {
			var div = $( '<div class="field"></div>' ).appendTo( me.e.main ), lbl = $( '<label for="struct-list">' + _str( 'structs' ) + '</label>' ).appendTo( div ), flt = $( '<span class="actions"></span>' ).appendTo( lbl );
			me.e.new_link = $( '<a class="action" href="#" class="new-struct">' + _str( 'edit' ) + '</a>' )
				.on( 'click.pui', function( e ) { e.preventDefault(); _edit_struct( me.e.structs_list.find( 'option:selected' ) ); } ).appendTo( flt );
			$( '<span class="sep"> | </span>' ).appendTo( flt );
			me.e.new_link = $( '<a class="action" href="#" class="new-struct">' + _str( 'new' ) + '</a>' ).on( 'click.pui', function( e ) { e.preventDefault(); _new_struct(); } ).appendTo( flt );
			me.e.structs_list = $( '<select class="structs-list widefat use-chosen" id="struct-list"></select>' )
				.on( 'change.pui', function( e ) { _load_struct( $( this ).val() ); } ).appendTo( div ).chosen();

			var div = $( '<div class="field"></div>' ).appendTo( me.e.main ), lbl = $( '<label for="ticket-list">' + _str( 'tickets' ) + '</label>' ).appendTo( div );
			me.e.tickets_list = $( '<select multiple="multiple" class="tickets-list widefat use-chosen" id="ticket-list"></select>' )
				.on( 'change.pui', function( e ) { _update_struct( me.e.structs_list.val(), $( this ).val() ); } ).appendTo( me.e.main ).chosen();
			
			$( '<div class="helper">' + _str( 'struct_msg' ) + '</div>' ).appendTo( me.e.main );
		}

		function _fill_elements() {
			me.e.structs_list.empty();
			me.e.tickets_list.empty();

			for ( i in S.data.structs ) if ( S.data.structs[ has ]( i ) )
				$( '<option>' + S.data.structs[ i ].name + '</option>' ).val( S.data.structs[ i ].id ).appendTo( me.e.structs_list );
			me.e.structs_list.trigger( 'chosen:updated' );

			for ( i in S.data.tickets ) if ( S.data.tickets[ has ]( i ) )
				$( '<option>' + S.data.tickets[ i ].text_display + '</option>' ).val( S.data.tickets[ i ].id ).appendTo( me.e.tickets_list );
			me.e.tickets_list.trigger( 'chosen:updated' );
		}

		function init() {
			_setup_elements();
			_fill_elements();
			_load_struct( me.e.structs_list.val() );
		}

		init();
	}

	QS.cbs.add( 'seating-chart-settings-to-be-saved', function( settings, ui, form ) {
		settings.pricing = S.data.structs;
	} );

	QS.cbs.add( 'settings-box-fields', function( fields, paper, ui ) {
		fields._all['pricing'] = { type:'none', name:'Pricing', attr:[ 'pricing' ], hidden:true };
	} );

	QS.cbs.add( 'settings-box-setup-elements', function( sb ) {
		var sbsect = $( '<div class="inner pricing-options"></div>' ).insertAfter( sb.e.aBoxIn ), has_opened = false, indexed = [], shared = {}, dia, div, customize, zone_list, struct_list, ticket_list;

		function _reset() {
			indexed = [];
			shared = {};
		}

		function _get_popup() {
			if ( ! qt.isO( dia ) || ! qt.is( dia.dialog ) ) {
				dia = $( '<div class="qsot qsot-dialog customize-pricing"></div>' ).appendTo( 'body' );
				
				div = $( '<div class="field"><h4>' + _str( 'zones' ) + '</h4></div>' ).appendTo( dia );
				zone_list = $( '<div class="zone-list"></div>' ).appendTo( div );

				div = $( '<div class="field"></div>' ).appendTo( dia );
				$( '<div><strong>' + _str( 'sure' ) + '</strong></div>' ).appendTo( div );
				customize = $( '<input type="checkbox" value="1" />' ).appendTo( div ).on( 'change', function( e ) { _toggle_fields( $( this ).is( ':checked' ) ); } );
				$( '<span class="cb-text">' + _str( 'yes' ) + '</span>' ).appendTo( div );
				
				div = $( '<div class="field"><h4>' + _str( 'structs' ) + '</h4></div>' ).appendTo( dia );
				struct_list = $( '<select class="widefat price-structs-list"></select>' ).appendTo( div ).on( 'change', function( e ) { _load_shared( $( this ).val() ); } );
				
				div = $( '<div class="field"><h4>' + _str( 'tickets' ) + '</h4></div>' ).appendTo( dia );
				ticket_list = $( '<select multiple="multiple" class="widefat price-structs-list"></select>' ).appendTo( div ).on( 'change', function( e ) { _update_shared( struct_list.val(), $( this ).val() ); } );

				$( '<div class="helper">' + _str( 'customize_msg' ) + '</div>' ).appendTo( dia );

				dia.dialog( {
					autoOpen: false,
					modal: true,
					width: 300,
					height: 'auto',
					closeOnEscape: true,
					title: _str( 'customize' ),
					position: { my:'center', at:'center', of:window, collision:'fit' }
				} );
			}

			return dia;
		}

		function _fill_elements() {
			var zone_str = [], need_check = true, i;
			for ( i = 0; i < sb.ui.canvas.Selection.items.length; i++ ) {
				var new_ind = indexed.length;
				indexed[ new_ind ] = {
					item: sb.ui.canvas.Selection.items[ i ],
					structs: JSON.parse( unescape( sb.ui.canvas.Selection.items[ i ].attr( 'pricing' ) || '{}' ) )
				};
				if ( Object.keys( indexed[ new_ind ].structs ).length ) need_check = false;
				var name = sb.ui.canvas.Selection.items[ i ].attr( 'zone' );
				zone_str.push( '<span title="' + sb.ui.canvas.Selection.items[ i ].node.tagName + '">' + ( qt.is( name ) ? name : '<span class="empty-name">' + _str( 'empty' ) + '</span>' ) + '</span>' );
			}

			zone_list.html( zone_str.join( ', ' ) );
			
			customize[ need_check ? 'removeAttr' : 'attr' ]( 'checked', 'checked' );
			struct_list.empty().removeAttr( 'disabled' );
			ticket_list.empty().removeAttr( 'disabled' );

			for ( i in S.data.structs ) if ( S.data.structs[ has ]( i ) )
				$( '<option>' + S.data.structs[ i ].name + '</option>' ).val( S.data.structs[ i ].id ).appendTo( struct_list );

			for ( i in S.data.tickets ) if ( S.data.tickets[ has ]( i ) )
				$( '<option>' + S.data.tickets[ i ].text_display + '</option>' ).val( S.data.tickets[ i ].id ).appendTo( ticket_list );
			
			_toggle_fields( ! need_check );
		}

		function _toggle_fields( chkd ) {
			if ( ! chkd ) {
				var i;
				for ( i = 0; i < indexed.length; i++ ) {
					indexed[ i ].structs = {}
					indexed[ i ].item.attr( 'pricing', '' );
				}
			}
			ticket_list[ ! chkd ? 'attr' : 'removeAttr' ]( 'disabled', 'disabled' ).trigger( 'chosen:updated' );
			struct_list[ ! chkd ? 'attr' : 'removeAttr' ]( 'disabled', 'disabled' ).trigger( 'chosen:updated' ).trigger( 'change' );
		}

		function _load_shared( struct_id ) {
			console.log( 'debug', shared, indexed );
			if ( ! qt.is( shared[ struct_id ] ) ) {
				var first = '';
				for ( i in indexed ) if ( indexed[ has ]( i ) ) {
					if ( qt.is( indexed[ i ].structs[ struct_id ] ) ) {
						if ( '' == first ) first = indexed[ i ].structs[ struct_id ].join( ',' );
						else if ( first != indexed[ i ].structs[ struct_id ].join( ',' ) ) {
							first = false;
							break;
						}
					}
				}

				if ( '' === first && qt.is( S.data.structs[ struct_id ] ) ) {
					shared[ struct_id ] = qt.is( S.data.structs[ struct_id ].prices['0'] ) ? S.data.structs[ struct_id ].prices['0'].slice() : [];
				} else if ( false === first ) {
					shared[ struct_id ] = [];
				} else {
					shared[ struct_id ] = first.split( /,/ );
				}
			}

			ticket_list.val( shared[ struct_id ] ).trigger( 'chosen:updated' );
		}

		function _update_shared( struct_id, val ) {
			shared[ struct_id ] = val;
			for ( i = 0; i < indexed.length; i++ ) {
				indexed[ i ].structs[ struct_id ] = val;
				indexed[ i ].item.attr( 'pricing', escape( JSON.stringify( indexed[ i ].structs ) ) );
			}
		}

		function _pricing_popup() {
			var dia = _get_popup();
			_reset();
			_fill_elements();
			dia.dialog( 'open' );
			if ( ! has_opened ) {
				struct_list.chosen();
				ticket_list.chosen();
			}
			has_opened = true;
			console.log( 'dia', dia );
		}

		sb.e.pricing_btn = $( '<a href="#" class="zone-price-options">' + _str( 'customize pricing' ) + '</a>' ).on( 'click', function( e ) { e.preventDefault(); _pricing_popup(); } ).appendTo( sbsect );
	} );

	function add_specific_pricing_to_zone( save, ui ) {
		if ( ! qt.is( save.id ) ) return;

		var ele = $( qt.is( save._ele ) ? save._ele.node : ( qt.is( save.abbr ) && save.abbr ? $( '#' + save.abbr ).get( 0 ) : undefined ) ),
				ps = {};

		for ( s in S.data.structs )
			if ( S.data.structs[ has ]( s ) )
				if ( S.data.structs[ s ].prices[ has ]( save.id ) )
					ps[ s ] = S.data.structs[ s ].prices[ save.id ];

		if ( Object.keys( ps ).length )
			ele.attr( 'pricing', escape( JSON.stringify( ps ) ) );
	}

	QS.cbs.add( 'create-from-save-circle', add_specific_pricing_to_zone )( 1000 );
	QS.cbs.add( 'create-from-save-square', add_specific_pricing_to_zone )( 1000 );
	QS.cbs.add( 'create-from-save-rectangle', add_specific_pricing_to_zone )( 1000 );
	QS.cbs.add( 'create-from-save-image', add_specific_pricing_to_zone )( 1000 );

	$( function() {
		( new pui( '[rel="price-ui"]' ) );
	} );
} )( jQuery, QS.Tools );
