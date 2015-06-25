// loads the admin ui for ticket selection
( function( $, q, qt ) {
	var S = $.extend( {}, _qsot_admin_seating_loader );

	$( function() {
		// get the order items table as the primary element. we will use this as a reference point throughout the ui code
		var tab = $( '.woocommerce_order_items' );
		tab.wrap( '<div class="qsot-event-area-ticket-selection"></div>' );

		// test features, and load the necessary version based on what is available
		q.Features.load( [
			{
				// we require cookies to work, since woocommerce requires cookies to track the cart. if cookies are on, then proceed
				name: 'cookies',
				run: function() {
					q.Loader.js( S.assets.res, 'qsot-seating-reservations', 'head', 'append', function() {
						S.resui = new QS.AdminReservations( tab, S );
						q.Features.load( [
							{
								// svg is the preferred method of interface. if it is available, then load the SVG interface
								name: 'svg',
								run: function() {
									if ( qt.isO( S.assets ) && qt.is( S.assets.svg ) )
										q.Loader.js( S.assets.snap, 'qsot-seating-snap', 'head', 'append', function() {
											q.Loader.js( S.assets.svg, 'qsot-seating-svgui', 'head', 'append', function() {
												function add_elements( eles, pui, tS ) {
													eles.inner_change_zones = $( tS.templates['inner:change:zones'] ).appendTo( eles.inner_change );
													eles.inner_change_no_zones = $( tS.templates['inner:change:no-zones'] ).appendTo( eles.inner_change );
													eles.inner_add_zones = $( tS.templates['inner:change:zones'] ).appendTo( eles.inner_add );
													eles.inner_add_no_zones = $( tS.templates['inner:change:no-zones'] ).appendTo( eles.inner_add );
													S.tsui = QS.AdminTS;
												} 
												QS.adminTicketSelection.callbacks.add( 'setup-elements', add_elements );

												QS.adminTicketSelection.callbacks.add( 'load-event', function( resp, eles, pui, tS ) {
													var data = resp.data, ca = pui.current_action, cur_display = eles.ev.css( 'display' )
													S.resui.update_options( $.extend( {}, S, data ), eles['inner_' + ca + '_zones'] );
													eles.ev.show();
													if ( qt.isO( data.edata.zones ) ) {
														eles['inner_' + ca + '_zones'].show();
														eles['inner_' + ca + '_no_zones'].hide();
														if ( ! qt.isO( S.selui ) ) {
															S.selui = QS.svgui( eles['inner_' + ca + '_zones'], $.extend( [], S, data ) );
														} else {
															S.selui.reinit( eles['inner_' + ca + '_zones'], $.extend( [], S, data ) );
														}
													} else {
														eles['inner_' + ca + '_no_zones'].show();
														eles['inner_' + ca + '_zones'].hide();
													}
													eles.ev.css( 'display', cur_display );
												} );

												if ( qt.isO( QS.AdminTS ) ) QS.AdminTS.addon( add_elements );
											} );
										} );
									else
										$( '<div class="error">Could not load the required components.</div>' ).insertBefore( tab );
								}
							},
							{
								// if svg is not available, then we can fallback to the basic 'dropdown' style, crappy interface that everyone else has
								name: 'fallback',
								run: function() {
									$( '<div class="error">Could not load a required component.</div>' ).insertBefore( tab );
								}
							}
						] );
					} )
				}
			},
			{
				// if cookies are off, then error out
				name: 'fallback',
				run: function() {
					$( '<div class="error">You do not have cookies enabled, and they are required.</div>' ).insertBefore( tab )
					alert( 'You must have cookies enabled in order to use the seat selection UI.' );
				}
			}
		] );
	} );
} )( jQuery, QS, QS.Tools );
