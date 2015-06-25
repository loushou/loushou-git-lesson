( function( $, EventUI, EditSetting, qt, undefined ) {
	EventUI.callbacks.add( 'add_event', function( args, orig ) {
		args['price_struct'] = '';
	} );

	EventUI.callbacks.add( 'before_submit_event_item', function( ev, evdata, defaults ) {
		ev['price_struct'] = evdata['price-struct'];
	} );

	EditSetting.callbacks.add( 'update', function( data, adjust ) {
		if ( this.tag == 'event-area' && ( $.inArray( typeof data['event-area'], [ 'string', 'number' ] ) != -1 || ( typeof data['event-area'] == 'object' && typeof data['event-area'].toString == 'function' ) ) ) {
			var test = $.inArray( typeof data['event-area'], [ 'string', 'number' ] ) != -1 ? data['event-area'] : data['event-area'].toString(),
			    p = this.elements.main_form.find( '[tag="price-struct"]' ), pool = p.find( '[rel="pool"]' ), vis_list = p.find( '[rel="vis-list"]' );
			if ( p.length ) {
				p = p.qsEditSetting( 'get' );
				if ( typeof p == 'object' && p.initialized ) {
					vis_list.empty();
					pool.find( 'option' ).each( function() {
						var me = $( this ), ea = me.attr( 'event-area-id' );
						if ( ! qt.is( ea ) || ea == test )
							me.clone().appendTo( vis_list );
					} );
				}
			}
		}
	} );
} )( jQuery, QS.EventUI, QS.EditSetting, QS.Tools );
