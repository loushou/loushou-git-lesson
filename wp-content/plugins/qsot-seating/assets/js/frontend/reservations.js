( function( $, qt ) {
	QS.Reservations = ( function() {
		var defs = {
					nonce: '',
					edata: {},
					ajaxurl: '/wp-admin/admin-ajax.php',
					templates: {},
					messages: {},
					owns: {}
				},
				has = 'hasOwnProperty';

		function _generic_efunc( r ) {
			if ( ! qt.is( console ) || ! qt.isF( console.log ) ) return;

			if ( qt.isO( r ) && qt.isA( r.e ) && r.e.length ) {
				for ( var i = 0; i < r.e.length; i++ )
					console.log( 'AJAX Error: ', r.e[ i ] );
			} else {
				console.log( 'AJAX Error: Unexpected ajax response.' );
			}
		}

		function _aj( data, func, efunc ) {
			var me = this;
					data = $.extend( { sa:'unknown' }, data, { action:'qsots-ajax', n:me.o.nonce, ei:me.o.edata.id } );

			$.ajax( {
				url: me.o.ajaxurl,
				data: data,
				dataType: 'json',
				error: efunc,
				method: 'POST',
				success: func,
				xhrFields: { withCredentials: true }
			} );
		}

		function _name_lookup() {
			this.names = {};
			this.unknown = this.msg( '(unknown)' );
			var i;
			for ( i in this.o.edata.zones )
				if ( this.o.edata.zones[ has ]( i ) )
					this.names[ this.o.edata.zones[ i ].id + '' ] = this.o.edata.zones[ i ].name;
		}

		function _setup_ui() {
			var me = this;

			me.e.main_wrap = me.e.main.parent();

			me.e.loading = $( me.tmpl( 'loading' ) ).insertAfter( me.e.main );

			me.e.psui = $( me.tmpl( 'psui' ) ).insertAfter( me.e.main );
			me.e.ps_box = me.e.psui.find( '[rel="box"]' );
			me.e.ps_error = me.e.psui.find( '[rel="error"]' );
			me.e.ps_backdrop = me.e.psui.find( '[rel="backdrop"]' );
			me.e.ps_list = me.e.psui.find( '[rel="price-list"]' );
			me.e.ps_qty_ui = me.e.psui.find( '[rel="qty-ui"]' );
			me.e.ps_qty = me.e.psui.find( '[rel="quantity"]' );
			me.e.ps_sel_list = me.e.psui.find( '[rel="sel-list"]' );

			me.e.ui = $( me.tmpl( 'ticket-selection' ) ).insertAfter( me.e.main );
			me.e.ui_title = me.e.ui.find( '[rel="title"]' );
			me.e.owns_cont = me.e.ui.find( '[rel="owns"]' );
			me.e.nosvg = me.e.ui.find( '[rel="nosvg"]' );
			me.e.actions = me.e.ui.find( '[rel="actions"]' );

			me.e.msgs = $( me.tmpl( 'msg-block' ) ).insertBefore( me.e.ui );
			me.e.errors = me.e.msgs.find( '[rel="errors"]' );
			me.e.confirms = me.e.msgs.find( '[rel="confirms"]' );

			me.e.owns_wrap = $( me.tmpl( 'owns-wrap' ) ).appendTo( me.e.owns_cont );
			me.e.owns = me.e.owns_wrap.find( '[rel="owns-list"]' );
			me.e.ubtn = me.e.owns_wrap.find( '[rel="update-btn"]' );
		}

		function _setup_events() {
			var me = this;

			me.e.owns.on( 'click', '[rel="remove-btn"]', function( e ) {
				e.preventDefault();
				var ele = $( this ), par = ele.parents( '.item' ), data = { items:[] };
				data.items.push( {
					state: par.is( '[rel="own-item"]' ) ? 'r' : 'i',
					zone: par.find( '[rel="zone"]' ).val(),
					'ticket-type': par.find( '[rel="ticket-type"]' ).val() || 0
				} );
				me.remove( data, function() { par.fadeOut( { duration:300, complete:function() { par.remove() } } ); } );
			} );

			me.e.owns.on( 'click', '[rel="continue-btn"]', function( e ) {
				var data = { items:[] }, par = $( this ).closest( '.item[key]' );
				if ( ! par.length ) return;

				data.items.push( {
					zone: par.find( '[rel="zone"]' ).val(),
					'ticket-type': 0,
					quantity: 1
				} );
				me.price_selection( data.items, function( selected_price, qty, after_resp ) {
					var i;
					for ( i = 0; i < data.items.length; i++ ) {
						data.items[ i ]['ticket-type'] = selected_price;
						data.items[ i ]['quantity'] = qty;
					}
					me.reserve( data );
				} );
			} );

			me.e.psui.on( 'click', '[rel="close"]', function( e ) {
				e.preventDefault();
				me.e.psui.trigger( 'early-close' );
				_reset_ps.call( me );
			} );
		}

		function _reset_ps() {
			var me = this;
			me.e.psui.hide();
			me.e.ps_sel_list.empty();
			me.e.ps_list.empty();
			me.e.ps_qty.attr( 'max', '' );
		}

		function _setup_existing() {
			if ( ! qt.isO( this.o.owns ) ) return;

			if ( qt.isA( this.o.owns.interest ) ) {
				var r = { s:true, r:[] }, i;
				for ( i = 0; i < this.o.owns.interest.length; i++ )
					_add_interest_row.call( this, this.o.owns.interest[ i ] );
			}

			if ( qt.isA( this.o.owns.reserved ) ) {
				var r = { s:true, r:[] }, i;
				for ( i = 0; i < this.o.owns.reserved.length; i++ )
					_add_reserve_row.call( this, this.o.owns.reserved[ i ] );
			}
		}

		function _clean( data ) {
			var out = $.extend( true, { items:[] }, data ), i;
			if ( ! qt.isA( out.items ) ) out.items = [];

			for ( i = 0; i < out.items.length; i++ )
				out.items[ i ] = $.extend( { zone:0, 'ticket-type':0, quantity:0 }, out.items[ i ] )

			return out;
		}

		function _req_from_data( data, extra ) {
			var out = $.extend( {}, extra, { items:[] } ), i;

			for ( i = 0; i < data.items.length; i++ ) {
				var tmp = { z:data.items[ i ].zone, t:data.items[ i ]['ticket-type'], q:data.items[ i ].quantity };
				if ( qt.is( data.items[ i ].state ) ) tmp.st = data.items[ i ].state;
				out.items.push( tmp )
			}

			return out;
		}

		function _call_as( done_as, func, prepend_params ) {
			var prepend_params = qt.isA( prepend_params ) ? prepend_params : [];
			return function() {
				var a = [].slice.call( arguments );
				return func.apply( done_as, prepend_params.concat( a ) );
			};
		}

		function _multi_call() {
			var args = [].slice.call( arguments ), i;
			return function() {
				var a = [].slice.call( arguments );
				for ( i = 0; i < args.length; i++ )
					if ( qt.isF( args[ i ] ) )
						args[ i ].apply( args[ i ], a );
			};
		}

		function _add_interest( req, r ) {
			if ( r.s && qt.isA( r.r ) ) {
				for ( var i = 0; i < r.r.length; i++ ) {
					var item = r.r[ i ];
					if ( item.c > 0 ) { // available quantity is greater than 0
						_add_interest_row.call( this, item );
					} else {
						_error_msg.call( this, this.msg( 'There are not enough %s tickets available.', this._name( item. z ) ) );
					}
				}
				_update_ui.call( this );
				QS.cbs.trigger( 'added-interest', [ r, req, this ] )
			} else if ( qt.isA( r.e ) && r.e.length ) {
				_error_msg.apply( this, r.e );
			}
		}

		function _add_interest_row( item ) {
			var k = item.z + ':' + item.t, kq = k + ':' + item.q,
					tmp = $( this.tmpl( 'interest-item' ) ).attr( { key:k, keyq:kq } ).appendTo( this.e.owns );
			_add_tt_to_row.call( this, tmp, item );
		}

		function _fail_interest( req, r ) {
			_error_msg.call( this, this.msg( 'Could not show interest in those tickets.' ) );
		}

		function _add_reserve( req, r ) {
			if ( r.s && qt.isA( r.r ) ) {
				for ( var i = 0; i < r.r.length; i++ ) {
					var item = r.r[ i ], k = item.z + ':' + item.t, kq = k + ':' + item.q;
					if ( item.s ) {
						_add_reserve_row.call( this, item )
					} else {
						_error_msg.call( this, this.msg( 'Could not reserve a ticket for %s.', this._name( item.z ) ) );
					}
				}
				_update_ui.call( this );
				QS.cbs.trigger( 'added-reserve', [ r, req, this ] )
			} else if ( qt.isA( r.e ) && r.e.length ) {
				_error_msg.apply( this, r.e );
			}
		}

		function _add_reserve_row( item ) {
			var k = item.z + ':' + item.t, k2 = item.z + ':0', kq = k + ':' + item.q, to_remove = $( '[key="' + k +'"], [key="' + k2 + '"]' ), tmp = $( this.tmpl( 'owns' ) ).attr( { key:k, keyq:kq } );
			if ( to_remove.length ) tmp.insertBefore( to_remove.get( 0 ) );
			else tmp.appendTo( this.e.owns );
			to_remove.remove();
			_add_tt_to_row.call( this, tmp, item );
		}

		function _fail_reserve( req, r ) {
			_error_msg.call( this, this.msg( 'Could not reserve those tickets.' ) );
		}

		function _remove_all( req, r ) {
			if ( r.s && qt.isA( r.r ) ) {
				for ( var i = 0; i < r.r.length; i++ ) {
					var item = r.r[ i ], k = item.z + ':' + item.t, kq = k + ':' + item.q;
					if ( item.s ) {
						var to_remove = $( '[key="' + k +'"]' ), tmp = $( this.tmpl( 'interest-item' ) ).attr( { key:k, keyq:kq } );
						to_remove.remove();
					} else {
						_error_msg.call( this, this.msg( 'Could not remove the tickets for %s.', this._name( item.z ) ) );
					}
				}
				_update_ui.call( this );
				QS.cbs.trigger( 'removed-res-int', [ r, req, this ] )
			} else if ( qt.isA( r.e ) && r.e.length ) {
				_error_msg.apply( this, r.e );
			}
			QS.cbs.trigger( 'removed-res-int-raw', [ r, req, this ] )
		}

		function _fail_remove( req, r ) {
			_error_msg.call( this, this.msg( 'Could not remove those tickets.' ) );
		}

		function _add_tt_to_row( row, item ) {
			var tid = item.t, zid = item.z,
					zone = { name:this.msg( '(pending)' ) },
					tt = qt.is( this.o.edata.tts[ tid + '' ] ) ? this.o.edata.tts[ tid + '' ] : { product_name:this.msg( '(pending)' ), product_raw_price:this.msg( '(pending)' ) },
					ele = $( this.tmpl( 'tt-display' ) ).appendTo( row.find( '[rel="tt_display"]' ) );

			zone = _zone_info.call( this, zid, zone );

			row.find( '[rel="quantity"]' ).html( item.q );
			row.find( '[rel="qty"]' ).val( item.q );
			row.find( '[rel="ticket-type"]' ).val( item.t );
			row.find( '[rel="zone"]' ).val( item.z );

			ele.find( '[rel="zone-name"]' ).html( zone.name || zone.abbr );
			if ( this.o.edata.zone_count < 1 )
				ele.find( '[rel="zone-name"]' ).parent().hide();
			ele.find( '[rel="ttname"]' ).html( tt.product_name );
			ele.find( '[rel="ttprice"]' ).html( tt.product_raw_price );
		}

		function _zone_info( zid, zone ) {
			if ( zid <= 0 ) return zone;
			if ( qt.is( this.z[ zid + '' ] ) ) return this.z[ zid + '' ];

			return zone;
		}

		function _error_msg() {
			var me = this, msgs = [].slice.call( arguments ), i = 0;
			for ( ; i < msgs.length; i++ ) {
				console.log( 'ERROR: ', msgs[ i ] );
				// do visual error
				var msg = $( '<div class="msg">' + msgs[ i ] + '</div>' ).appendTo( me.e.errors );
				setTimeout( function() { msg.fadeOut( { duration:1000, complete:function() {
					$( this ).remove();
					if ( 0 == me.e.errors.find( '.msg' ).length )
						me.e.errors.slideUp( { duration:250, complete:function() { _maybe_hide_msgs.call( me ); } } );
				} } ); }, 3500 );
			}

			me.e.msgs.show();
			me.e.errors.slideDown( 250 );
		}

		function _confirm_msg() {
			var me = this, msgs = [].slice.call( arguments ), i = 0;
			for ( ; i < msgs.length; i++ ) {
				console.log( 'CONFIRMS: ', msgs[ i ] );
				// do visual error
				var msg = $( '<div class="msg">' + msgs[ i ] + '</div>' ).appendTo( me.e.confirms );
				setTimeout( function() { msg.fadeOut( { duration:1000, complete:function() {
					$( this ).remove();
					if ( 0 == me.e.confirms.find( '.msg' ).length )
						me.e.confirms.slideUp( { duration:250, complete:function() { _maybe_hide_msgs.call( me ); } } );
				} } ); }, 3500 );
			}

			me.e.msgs.show();
			me.e.errors.slideDown( 250 );
		}

		function _maybe_hide_msgs() {
			var me = this, any_shown = false;
			me.e.msgs.find( '> .inner' ).each( function() { if ( 'none' != $( this ).css( 'display' ) ) any_shown = true; } );
			if ( ! any_shown )
				me.e.msgs.slideUp( 250 );
		}

		function _update_ui() {
			if ( this.e.owns.find( '[rel="own-item"]' ).length ) {
				this.e.ui_title.html( this.tmpl( 'two-title' ) );
				this.e.owns_wrap.find( '.section-heading' ).show();
				this.e.actions.show();
			} else {
				this.e.ui_title.html( this.tmpl( 'one-title' ) );
				this.e.owns_wrap.find( '.section-heading' ).hide();
				this.e.actions.hide();
			}

			if ( this.e.owns.find( '.item.multiple' ).length ) {
				this.e.ubtn.show();
			} else {
				this.e.ubtn.hide();
			}
		}

		function _common_prices( items ) {
			var me = this, common_prices = {}, i, j;
			for ( i = 0; i < items.length; i++ ) {
				var item = items[ i ], prices = qt.is( me.o.edata.ps[ item.z + '' ] ) ? me.o.edata.ps[ item.z + '' ] : me.o.edata.ps['0'];
				if ( 0 == i ) {
					for ( j = 0; j < prices.length; j++ )
						common_prices[ prices[ j ].product_id + '' ] = prices[ j ];
				} else {
					var my_list = [], cp = common_prices, common_prices = {};
					for ( j = 0; j < prices.length; j++ )
						my_list.push( prices[ j ].product_id );
					for ( j in cp ) if ( cp[ has ]( j ) ) {
						if ( j in my_list ) common_prices[ j ] = cp[ j ];
					}
				}
			}

			return common_prices;
		}

		function res( e, o ) {
			this.e = { main:e };
			this.o = $.extend( true, {}, defs, o );
			this.r = [];
			this.z = $.extend( {}, this.o.edata.zones );

			this.init();
		}

		res.prototype = {
			init: function() {
				if ( this.initialized ) return;
				this.initialized = true;

				_name_lookup.call( this );
				_setup_ui.call( this );
				_setup_events.call( this );
				_setup_existing.call( this );
				_update_ui.call( this );
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

			_name: function( zid ) { return qt.is( this.names[ zid + '' ] ) ? this.names[ zid + '' ] : this.unknown; },

			price_selection: function( items, upon_select_func, early_close ) {
				var me = this, req = _req_from_data( { items:items.slice(0) } ), common_prices = _common_prices.call( this, req.items ), znames = [], max_qty, i;
				
				for ( i = 0; i < items.length; i++ ) {
					if ( qt.is( me.z[ items[ i ].zone ] ) && qt.isA( me.o.edata.stati[ items[ i ].zone ] ) ) {
						znames.push( me.z[ items[ i ].zone ].name );
						if ( ! qt.is( max_qty ) ) max_qty = me.o.edata.stati[ items[ i ].zone ][1];
						else max_qty = Math.min( max_qty, me.o.edata.stati[ items[ i ].zone ][1] );
					}
				}
				me.e.ps_sel_list.text( znames.join( ', ' ) );
				me.e.ps_qty.attr( 'max', max_qty + '' );
				if ( max_qty > 1 ) me.e.ps_qty_ui.show();
				else {
					me.e.ps_qty_ui.hide();
					if ( max_qty <= 0 )
						_error_msg.call( me, me.msg( 'There are not enough %s tickets available.', znames.join( ', ' ) ) );
				}

				for ( i in common_prices ) if ( common_prices[ has ]( i ) ) ( function( price ) {
					var prd_id = price.product_id, li = $( me.tmpl( 'psui-price' ) ).appendTo( me.e.ps_list ).on( 'click', function( e ) {
						e.preventDefault();
						var qty = me.e.ps_qty.val();
						_reset_ps.call( me );
						me.show_loading();
						if ( qt.isF( upon_select_func ) )
							upon_select_func( prd_id, qty, function() { me.hide_loading(); } );
					} );
					li.find( '[rel="name"]' ).html( price.product_name );
					li.find( '[rel="price"]' ).html( price.product_display_price );
				} )( common_prices[ i ] );

				var pdims = { width:me.e.main_wrap.width(), height:me.e.main_wrap.height() },
						chart = me.e.main_wrap.find( '#svgui' ),
						cdims = chart.length ? { width:chart.width(), height:chart.height() } : { width:pdims.width, height:100 };

				this.e.psui.off( 'early-close.psui' ).on( 'early-close.psui', function( e ) {
					if ( qt.isF( early_close ) ) {
						early_close( e, items );
					}
					var data = { items:items }, i;
					for ( i = 0; i < data.items.length; i++ ) {
						data.items[ i ]['state'] = 'i';
						data.items[ i ]['ticket-type'] = 0;
					}
					me.remove( data );
				} );

				this.e.psui.show();
				var dims = { width:me.e.ps_box.width(), height:me.e.ps_box.height() };
				me.e.ps_box.css( { top:( cdims.height - dims.height ) / 2, left:( cdims.width - dims.width ) / 2 } );
			},

			show_loading: function() {
				this.e.loading.show();
			},

			hide_loading: function() {
				this.e.loading.hide();
			},

			interest: function( data, func, efunc ) {
				var req = _req_from_data( _clean( data ), { sa:'int' } ),
						me = this,
						func = qt.isF( func ) ? func : function( r ) {},
						efunc = qt.isF( efunc ) ? efunc : _generic_efunc;
				this.show_loading();
				_aj.call( this, req, _multi_call( _call_as( me, _add_interest, [ req ] ), func, _call_as( me, this.hide_loading ) ), _multi_call( _call_as( me, _fail_interest, [ req ] ), efunc, _call_as( me, this.hide_loading ) ) );
			},

			reserve: function( data, func, efunc ) {
				var req = _req_from_data( _clean( data ), { sa:'res' } ),
						me = this,
						func = qt.isF( func ) ? func : function( r ) {},
						efunc = qt.isF( efunc ) ? efunc : _generic_efunc;
				this.show_loading();
				_aj.call( this, req, _multi_call( _call_as( me, _add_reserve, [ req ] ), func, _call_as( me, this.hide_loading ) ), _multi_call( _call_as( me, _fail_reserve, [ req ] ), efunc, _call_as( me, this.hide_loading ) ) );
			},

			remove: function( data, func, efunc ) {
				var req = _req_from_data( _clean( data ), { sa:'rm' } ),
						me = this,
						func = qt.isF( func ) ? func : function( r ) {},
						efunc = qt.isF( efunc ) ? efunc : _generic_efunc;
				this.show_loading();
				_aj.call( this, req, _multi_call( _call_as( me, _remove_all, [ req ] ), func, _call_as( me, this.hide_loading ) ), _multi_call( _call_as( me, _fail_remove, [ req ] ), efunc, _call_as( me, this.hide_loading ) ) );
			}
		};

		return res;
	} )();
} )( jQuery, QS.Tools );
