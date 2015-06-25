// loads the frontend ui for ticket selection
( function( $, q, qt ) {
	var S = $.extend( { messages:{} }, _qsot_seating_loader );

	function __( name ) {
		var args = [].slice.call( arguments, 1 ), str = qt.is( S.messages[ name ] ) ? S.messages[ name ] : name, i;
		for ( i = 0; i < args.length; i++ ) str = str.replace( '%s', args[ i ] );
		return str;
	}

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

						var modes = [];
						if ( qt.isO( S.edata ) && qt.isO( S.edata.zones ) && Object.keys( S.edata.zones ).length ) {
							modes.push( {
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
										$( '<div class="error">' + __( 'Could not load the required components.' ) + '</div>' ).appendTo( sel.empty() );
								}
							} );
						}

						modes.push( {
							// if svg is not available, then we can fallback to the basic 'dropdown' style, crappy interface that everyone else has
							name: 'fallback',
							run: function() {
								if ( qt.isO( S.assets ) && qt.is( S.assets.svg ) )
									q.Loader.js( S.assets.nosvg, 'qsot-seating-nosvgui', 'head', 'append', function() {
										QS.nosvgui( $( '[rel="ticket-selection"]' ).empty(), S );
									} );
								else
									$( '<div class="error">' + __( 'Could not load a required component.' ) + '</div>' ).appendTo( sel.empty() );
							}
						} );

						q.Features.load( modes );
					} )
				}
			},
			{
				// if cookies are off, then error out
				name: 'fallback',
				run: function() {
					$( '<div class="error">' + __( 'You do not have cookies enabled, and they are required.' ) + '</div>' ).appendTo( sel.empty() );
					alert( __( 'You must have cookies enabled to purchase tickets.' ) );
				}
			}
		] );
	} );
} )( jQuery, QS, QS.Tools );
