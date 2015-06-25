// loads the frontend ui for ticket selection
( function( $, q, qt ) {
	var S = $.extend( {}, _qsot_seating_loader );

	$( function() {
		// the UI container
		var sel = $( '[rel="ticket-selection"]' );

		// test features, and load the necessary version based on what is available
		q.Features.load( [
			{
				// we require cookies to work, since woocommerce requires cookies to track the cart. if cookies are on, then proceed
				name: 'cookies',
				run: function() {
					q.Loader.js( S.assets.res, 'qsot-seating-reservations', 'head', 'append', function() {
						S.resui = new QS.Reservations( $( '[rel="ticket-selection"]' ), S );
						q.Features.load( [
							{
								// svg is the preferred method of interface. if it is available, then load the SVG interface
								name: 'svg',
								run: function() {
									if ( qt.isO( S.assets ) && qt.is( S.assets.svg ) )
										q.Loader.js( S.assets.snap, 'qsot-seating-snap', 'head', 'append', function() {
											q.Loader.js( S.assets.svg, 'qsot-seating-svgui', 'head', 'append', function() {
												QS.svgui( $( '[rel="ticket-selection"]' ).empty(), S );
											} );
										} );
									else
										$( '<div class="error">Could not load the required components.</div>' ).appendTo( sel.empty() );
								}
							},
							{
								// if svg is not available, then we can fallback to the basic 'dropdown' style, crappy interface that everyone else has
								name: 'fallback',
								run: function() {
									if ( qt.isO( S.assets ) && qt.is( S.assets.svg ) )
										q.Loader.js( S.assets.nosvg, 'qsot-seating-nosvgui', 'head', 'append', function() {
											QS.nosvgui( $( '[rel="ticket-selection"]' ).empty(), S );
										} );
									else
										$( '<div class="error">Could not load a required component.</div>' ).appendTo( sel.empty() );
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
					$( '<div class="error">You do not have cookies enabled, and they are required.</div>' ).appendTo( sel.empty() );
					alert( 'You must have cookies enabled to purchase tickets.' );
				}
			}
		] );
	} );
} )( jQuery, QS, QS.Tools );
