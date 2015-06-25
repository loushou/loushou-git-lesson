( function( $, qt ) {
	QS.nosvgui = ( function() {
		var defs = {
					nonce: '',
					edata: {},
					ajaxurl: '/wp-admin/admin-ajax.php',
					templates: {},
					messages: {},
					owns: {}
				},
				has = 'hasOwnProperty';

		function _setup_elements() {
			var i = 0, z = 0;

			this.o.resui.e.nosvg.empty();

			this.o.resui.e.ns_sel = $( this.o.resui.tmpl( 'sel-nosvg' ) ).appendTo( this.o.resui.e.nosvg );

			this.o.resui.e.ns_helper = this.o.resui.e.ns_sel.find( '.helper' );
			this.o.resui.e.ns_avail = $( this.o.resui.tmpl( 'helper:available' ) ).appendTo( this.o.resui.e.ns_helper ).hide();
			this.o.resui.e.ns_more_avail = $( this.o.resui.tmpl( 'helper:more-available' ) ).appendTo( this.o.resui.e.ns_helper ).hide();

			_update_avail_msg.call( this );

			this.o.resui.e.ns_ttedit = this.o.resui.e.ns_sel.find( '[rel="tt_edit"]' );

			if ( this.o.edata.zone_count > 1 ) {
				this.o.resui.e.ns_zsel = this.o.resui.e.ns_zid = $( this.o.resui.tmpl( 'zone-select' ) ).appendTo( this.o.resui.e.ns_ttedit );
				this.o.resui.e.ns_zopt = $( this.o.resui.tmpl( 'zone-option' ) );
				for ( i in this.o.edata.zones )
					if ( this.o.edata.zones[ has ]( i ) )
						this.o.resui.e.ns_zopt.clone().appendTo( this.o.resui.e.ns_zsel ).val( this.o.edata.zones[ i ].id ).html( this.o.edata.zones[ i ].name );
			} else {
				this.o.resui.e.ns_zsel_single = $( this.o.resui.tmpl( 'zone-single' ) ).appendTo( this.o.resui.e.ns_ttedit );
				this.o.resui.e.ns_zsel_single_id = this.o.resui.e.ns_zid = this.o.resui.e.ns_zsel_single.find( '[rel="zone"]' ).val( '0' );
				this.o.resui.e.ns_zsel_single_name = this.o.resui.e.ns_zsel_single.find( '[rel="name"]' );
				for ( i in this.o.edata.zones )
					if ( this.o.edata.zones[ has ]( i ) ) {
						this.o.resui.e.ns_zsel_single_id.val( this.o.edata.zones[ i ].id + '' );
						this.o.resui.e.ns_zsel_single_name.html( this.o.edata.zones[ i ].name );
						z = this.o.edata.zones[ i ].id + '';
					}
			}

			if ( this.o.edata.tt_count > 1 ) {
				this.o.resui.e.ns_ttsel = this.o.resui.e.ns_tid = $( this.o.resui.tmpl( 'tt-select' ) ).appendTo( this.o.resui.e.ns_ttedit );
				this.o.resui.e.ns_ttopt = $( this.o.resui.tmpl( 'tt-option' ) );
				if ( this.o.edata.zone_count <= 1 )
					_update_zone_tts.call( this );
			} else if ( 1 == this.o.edata.tt_count ) {
				var tt;
				for ( i in this.o.edata.tts )
					if ( this.o.edata.tts[ has ]( i ) )
						tt = this.o.edata.tts[ i ];
				this.o.resui.e.ns_ttsel_single = $( this.o.resui.tmpl( 'tt-single' ) ).appendTo( this.o.resui.e.ns_ttedit );
				this.o.resui.e.ns_ttsel_single_id = this.o.resui.e.ns_tid = this.o.resui.e.ns_ttsel_single.find( '[rel="ticket-type"]' ).val( tt.product_id );
				this.o.resui.e.ns_ttsel_single_name = this.o.resui.e.ns_ttsel_single.find( '[rel="ttname"]' ).html( tt.product_name );
				this.o.resui.e.ns_ttsel_single_price = this.o.resui.e.ns_ttsel_single.find( '[rel="ttprice"]' ).html( tt.product_display_price );
			}
		}

		function _update_avail_msg() {
			var me = this;
			this.o.resui.e.ns_helper.find( '.available' ).text( this.o.edata.available );
			if ( me.o.edata.zone_count <= 1 ) {
				if ( Object.keys( this.o.owns ).length ) {
					this.o.resui.e.ns_more_avail.show();
				} else {
					this.o.resui.e.ns_avail.show();
				}
			} else {
				this.o.resui.e.ns_more_avail.hide();
				this.o.resui.e.ns_avail.hide();
			}
		}

		function _update_zone_tts() {
			if ( this.o.edata.tt_count <= 1 || ! this.o.resui.e.ns_ttsel.length ) return;
			this.o.resui.e.ns_ttsel.empty();

			var z = this.o.resui.e.ns_zid.val(), ps = qt.is( this.o.edata.tts[ z ] ) ? this.o.edata.tts[ z ] : ( qt.is( this.o.edata.tts['0'] ) ? this.o.edata.tts['0'] : [] ), i;
			if ( ! ps.length ) return;

			for ( i in ps )
				if ( ps[ has ]( i ) )
					this.o.resui.e.ns_ttopt.clone().appendTo( this.o.resui.e.ns_ttsel ).val( ps[ i ].product_id ).html( ps[ i ].product_name + ' ' + ps[ i ].product_display_price );
		}

		function update_available_totals( r ) {
			var me = this, i;
			if ( me.o.edata.zone_count <= 1 && qt.isA( r ) ) {
				for ( i = 0; i < r.length; i++ ) {
					me.o.edata.available = r[ i ].c;
				}
			}
			_update_avail_msg.call( me );
		}

		function update_available_totals_wrap( r ) {
			update_available_totals.call( this, r.r );
		}

		function _setup_events() {
			var me = this;

			this.o.resui.e.nosvg.off( 'click.nosvg', '[rel="reserve-btn"]' ).on( 'click.nosvg', '[rel="reserve-btn"]', function( e ) {
				e.preventDefault();
				
				var item = $( this ).closest( '.field' ).louSerialize();
				if ( me.o.edata.zone_count > 0 ) {
					me.o.resui.interest( { items:[ item ] } );
				} else {
					me.o.resui.reserve( { items:[ item ] } );
				}
			} );

			if ( this.o.resui.e.ns_zsel )
				this.o.resui.e.ns_zsel.off( 'change.nosvg' ).on( 'change.nosvg', function( e ) {
					if ( me.o.edata.tt_count <= 1 ) return;
					_update_zone_tts.call( me );
				} );

			QS.cbs.remove( 'removed-res-int-raw', function() { return update_available_totals_wrap.apply( me, [].slice.call( arguments ) ); } );
			QS.cbs.add( 'removed-res-int-raw', function() { return update_available_totals_wrap.apply( me, [].slice.call( arguments ) ); } );
			QS.cbs.remove( 'added-reserve', function() { return update_available_totals_wrap.apply( me, [].slice.call( arguments ) ); } );
			QS.cbs.add( 'added-reserve', function() { return update_available_totals_wrap.apply( me, [].slice.call( arguments ) ); } );
			QS.cbs.remove( 'added-interest', function() { return update_available_totals_wrap.apply( me, [].slice.call( arguments ) ); } );
			QS.cbs.add( 'added-interest', function() { return update_available_totals_wrap.apply( me, [].slice.call( arguments ) ); } );

			function added_reserve() { me.reserve_resp.apply( me, [].slice.call( arguments ) ); }
			QS.cbs.remove( 'added-reserve', added_reserve );
			QS.cbs.add( 'added-reserve', added_reserve );

			function added_interest() { me.interest_resp.apply( me, [].slice.call( arguments ) ); }
			QS.cbs.remove( 'added-interest', added_interest );
			QS.cbs.add( 'added-interest', added_interest );
		}

		function ui( ele, o ) {
			this.o = $.extend( {}, defs, o );
			this.e = { main:ele };

			this.init();
		}

		ui.prototype = {
			init: function() {
				if ( qt.is( this.o.resui ) ) {
					_setup_elements.call( this );
					_setup_events.call( this );
				}
			},

			reserve_resp: function( r, req, resui ) {
				var me = this, ritem, z;
				if ( ! r || ! qt.isA( r.r ) || ! r.r.length )
					return;

				update_available_totals.call( me, r.r );
			},

			interest_resp: function( r, req, resui ) {
				var me = this;
				if ( ! r || ! qt.isA( r.r ) || ! r.r.length )
					return;

				var data = { items:[] }, prices = qt.isO( this.o.edata.ps ) ? this.o.edata.ps : { '0':[] }, i;
				for ( i = 0; i < r.r.length; i++ ) {
					var ritem = r.r[ i ];
					if ( ! ritem.s )
						break;
					
					var price_cnt = qt.is( prices[ ritem.z + '' ] ) ? prices[ ritem.z + '' ].length : prices['0'].length,
							p = qt.is( prices[ ritem.z + '' ] ) ? prices[ ritem.z + '' ][0].product_id : prices['0'][0].product_id;
					data.items.push( { zone:ritem.z, 'ticket-type':p, quantity:ritem.q } );
				}

				update_available_totals.call( me, r.r );

				if ( data.items.length )
					me.o.resui.reserve( data );
			}
		};

		function start_ui( ele, o ) {
			return new ui( ele, o );
		}

		return start_ui;
	} )();
} )( jQuery, QS.Tools );
