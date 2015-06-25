<?php (__FILE__ == $_SERVER['SCRIPT_FILENAME']) ? die(header('Location: /')) : null;

if ( ! is_admin() ) return;

// handles the edit order page admin utilities, such as changing seats or creating reservations, etc, etc...
class QSOT_seating_order_admin {
	protected static $o = null;

	public static function pre_init() {
		// first thing, load all the options, and share them with all other parts of the plugin
		$settings_class_name = apply_filters('qsot-settings-class-name', '');
		if (!class_exists($settings_class_name)) return false;
		self::$o = call_user_func_array(array($settings_class_name, "instance"), array());

		// remove core OTCE actions so they can be replaced
		add_action( 'wp_loaded', array( __CLASS__, 'remove_core_actions' ), 10, 1 );

		// load list of admin assets when admin loads
		add_action( 'admin_init', array( __CLASS__, 'register_admin_assets' ), 100 );

		// core action takeovers
		add_action( 'woocommerce_hidden_order_itemmeta', array( __CLASS__, 'hide_item_meta' ), 100, 1 );

		// add the zone name display to the ticket meta
		add_action( 'qsot-ticket-item-meta', array( __CLASS__, 'add_zone_to_order_item_display' ), 1, 3 );

		// add to the admin ticket selection ui
		add_filter( 'qsot-ticket-selection-templates', array( __CLASS__, 'admin_ui_templates' ), 1000, 3 );

		// admin ticket selection ui ajax functions
		add_filter( 'qsot-ticket-selection-admin-ajax-load-event', array( __CLASS__, 'aaj_ts_load_event' ), 1000, 2 );

		// admin edit order page assets
		add_action( 'qsot-admin-load-assets-shop_order', array( __CLASS__, 'load_assets_edit_order' ), 10, 2 );

		// handle ajax calls using the new ui
		add_action( 'wp_ajax_qsots-admin-ajax', array( __CLASS__, 'handle_admin_ajax' ), 10 );
		add_filter( 'qsots-admin-ajax-int', array( __CLASS__, 'aj_interest' ), 10, 2 );
		add_filter( 'qsots-admin-ajax-res', array( __CLASS__, 'aj_reserve' ), 10, 2 );
		add_filter( 'qsots-admin-ajax-rm', array( __CLASS__, 'aj_remove' ), 10, 2 );

		// create/update order item for reservation in admin
		add_filter( 'qsot-seating-admin-update-order-item', array( __CLASS__, 'update_order_item' ), 10, 2 );
	}

	public static function register_admin_assets() {
		wp_register_script( 'qsot-seating-admin-seat-selection-loader', QSOT_seating_launcher::plugin_url() . 'assets/js/admin/loader.js', array( 'qsot-admin-ticket-selection' ) );
	}

	// load the assets used in the admin for the edit order page
	public static function load_assets_edit_order( $exists, $order_id ) {
		$url = QSOT_seating_launcher::plugin_url() . 'assets/';

		wp_enqueue_style( 'qsot-seating-frontend-ui' );
		wp_enqueue_script( 'qsot-seating-admin-seat-selection-loader' );
		wp_localize_script( 'qsot-seating-admin-seat-selection-loader', '_qsot_admin_seating_loader', array(
			'assets' => array(
				'snap' => $url . 'js/libs/snapsvg/snap.svg' /*. $debug */ . '.js',
				'svg' => $url . 'js/frontend/ui.js',
				'res' => $url . 'js/admin/reservations.js',
			),
			'nonce' => wp_create_nonce( 'qsot-admin-seat-selection-' . $order_id ),
			'order_id' => $order_id,
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
		) );
	}

	// remove core OTCE actions so that we can safely replace them
	public static function remove_core_actions() {
		// remove the core list of hidden meta, so that we can substitute our new list
		add_filter( 'woocommerce_hidden_order_itemmeta', array( 'qsot_seat_pricing', 'hide_item_meta' ), 10 );
	}

	// add to the list of hidden order item meta for the admin dislay
	public static function hide_item_meta( $list ) {
		$list[] = '_event_id';
		$list[] = '_zone_id';
		return $list;
	}

	// add the zone information to the order item display
	public static function add_zone_to_order_item_display( $item_id, $item, $_product ) {
		if ( 'yes' != $_product->ticket ) return;

		$display = '(unselected)';
		if ( isset( $item['zone_id'] ) && ! empty( $item['zone_id'] ) ) {
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['zone_id'] );
			if ( is_object( $zone ) )
				$display = apply_filters( 'the_title', $zone->name );
		}

		?><div class="info"><strong><?php _e( 'Seat:', 'qsot-seating' ) ?></strong> <?php echo $display ?></div><?php
	}

	// add to the admin ticket selection ui our templates needed for this plugin
	public static function admin_ui_templates( $list, $exists, $order_id ) {
		$list['dialog-shell'] = '<div class="ticket-selection-dialog" title="Select Ticket">'
				.'<div class="errors" rel="errors"></div>'
				.'<div class="event-info" rel="info"></div>'
				.'<div class="actions" rel="actions"></div>'
				.'<div class="display-transition" rel="transition"></div>'
				.'<div class="display-event qsot-event-area-ticket-selection" rel="event-wrap"></div>'
				.'<div class="display-calendar" rel="calendar-wrap"></div>'
			.'</div>';

		$list['inner:change'] = '<div class="change-ui" rel="change-ui"></div>';
		$list['inner:add'] = '<div class="add-ui" rel="add-ui"></div>';

		$list['inner:change:zones'] = '<div class="ticket-selection-ui" rel="svgui"></div>';
		$list['inner:add:zones'] = '<div class="ticket-selection-ui" rel="svgui"></div>';

		$list['inner:change:no-zones'] = '<div class="image-wrap" rel="image-wrap"></div>';
		$list['inner:add:no-zones'] = '<div class="add-tickets-ui" rel="add-ui">'
				.'<div class="ticket-form ts-section">'
					.'<span class="ticket-name" rel="ttname"></span>'
					.'<input type="number" min="1" max="100000" step="1" rel="ticket-count" name="qty" value="1" />'
					.'<input type="button" class="button" rel="add-btn" value="'.__('Add Tickets','opentickets-community-edition').'" />'
				.'</div>'
				.'<div class="image-wrap" rel="image-wrap"></div>'
			.'</div>';

		$list['psui'] = '<div class="price-selection-ui">'
				. '<div class="price-selection-error" rel="error">'
					. '<div class="msg" rel="msg"></div>'
					. '<div class="error-accept">'
						. '<a href="#" rel="close">' . __( 'OK', 'qsot-seating' ) . '</a>'
					. '</div>'
				. '</div>'
				. '<div class="price-selection-box" rel="box">'
					. '<div class="title-bar">'
						. '<h4 class="price-selection-title">'
							. __( 'Select a price:', 'qsot-seating' )
							. '<div class="close" rel="close">X</div>'
						. '</h4>'
					. '</div>'
					. '<div class="price-ui-content">'
						. '<div class="for-ui field" rel="for-iu">'
							. '<span class="label">' . __( 'For:', 'qsot-seating' ) . ' </span>'
							. '<span class="value selection-list" rel="sel-list"></span>'
						. '</div>'
						. '<div class="quantity-ui field" rel="qty-ui">'
							. '<div class="label">' . __( 'How many?', 'qsot-seating' ) . '</div>'
							. '<div class="value"><input type="number" min="0" step="1" rel="quantity" value="1" /></div>'
						. '</div>'
						. '<div class="available-prices field" rel="price-list-wrap">'
							. '<div class="label">' . __( 'Pricing Option:', 'qsot-seating' ) . '</div>'
							. '<ul rel="price-list"></ul>'
						. '</div>'
					. '</div>'
				. '</div>'
				. '<div class="price-selection-backdrop" rel="backdrop"></div>'
			. '</div>';

		$list['psui-price'] = '<li class="item" rel="price">'
				. '<span class="name" rel="name"></span>'
				. ' (<span class="price" rel="price"></span>)'
			. '</div>';

		return $list;
	}

	// add to the loaded event information, so that the seating ui can function
	public static function aaj_ts_load_event( $resp, $data ) {
		// if there is no event data already loaded, then this is a fail already, so continue to faile
		if ( ! isset( $resp['data'], $resp['data']['id'] ) ) return $resp;

		// fetch the relevant ids from the data
		$event_id = $data['eid'];
		$oiid = $data['oiid'];
		$oid = $data['order_id'];

		// load the event data
		$event = apply_filters( 'qsot-get-event', false, $resp['data']['id'] );
		if ( ! is_object( $event ) ) return $resp;
		// load the list of event zones
		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );

		// put all the data together in a fashion that the frontend script knows how to use it
		$resp['data'] = array_merge( $resp['data'], array(
			'edata' => QSOT_seating_core::frontend_edata( $event ),
			'nonce' => wp_create_nonce( 'qsot-admin-seat-selection-' . $oid ),
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
			'templates' => apply_filters( 'qsot-seating-frontend-templates', array(), $event ),
			'messages' => apply_filters( 'qsot-seating-frontend-msgs', array(), $event ),
			'owns' => QSOT_seating_core::owns_for_frontend( apply_filters( 'qsot-zoner-ownerships', array(), $event->ID, 0, false, false, $oid, false, 0 ), $event ),
		) );

		return $resp;
	}

	// handle the admin ajax requests for the seat selection tool
	public static function handle_admin_ajax() {
		$resp = array( 's' => false );

		// ajax security. user must be logged in and able to edit posts, plus the nonce needs to match
		if ( is_user_logged_in() && current_user_can( 'edit_posts' ) && isset( $_POST['n'], $_POST['ei'], $_POST['sa'], $_POST['oid'] ) && wp_verify_nonce( $_POST['n'], 'qsot-admin-seat-selection-' . ( (int)$_POST['oid'] ) ) ) {
			$sa = $_POST['sa'];

			// perform this specific sub action if a filter exists for it
			if ( has_action( 'qsots-admin-ajax-' . $sa ) )
				$resp = apply_filters( 'qsots-admin-ajax-' . $sa, $resp, $sa );

			// also perform an 'all' action, similar to the wp 'all' action, but for these ajax requests
			if ( has_action( 'qsots-admin-ajax-all' ) )
				$resp = apply_filters( 'qsots-admin-ajax-all', $resp, $sa );
		// if the security does not pass, spit out a generic error
		} else {
			$resp['e'] = array( __( 'An unexpected error has occurred.', 'qsot-seating' ) );
		}

		// output results in json format by default
		echo @json_encode( $resp );
		exit;
	}

	// create a temporary interest in the zone while the admin user selects the relevant ticket information
	public static function aj_interest( $resp ) {
		// make sure we have a list of tickets to show interst in
		if ( ! isset( $_POST['items'] ) || ! is_array( $_POST['items'] ) ) {
			$resp['e'] = array( __( 'You must select some zones.', 'qsot-seating' ) );
			return $resp;
		}

		$event_id = (int)$_POST['ei'];
		$resp['e'] = $resp['r'] = array();
		$order_id = (int)$_POST['oid'];

		// if no event_id or order_id is present, then fail
		if ( $event_id <= 0 || $order_id <= 0 ) {
			$resp['e'] = array( __( 'Some of the required information is missing from your request.', 'qsot-seating' ) );
			return $resp;
		}

		// for each item we are showing interest in
		foreach ( $_POST['items'] as $item ) {
			// make sure that the zone is for the selected event
			if ( ! apply_filters( 'qsot-zoner-is-zone-for-event', false, (int)$item['z'], $event_id ) ) {
				$resp['e'][] = sprintf( __( 'The specified zone is not available for this event. [%s]', 'qsot-seating' ), $item['z'] );
				continue;
			}

			// make sure that teh zone actually does exist, and that it has seats available
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['z'] );
			if ( ! apply_filters( 'qsot-zoner-get-event-zone-available', false, (int)$item['z'], $event_id, array( 'order_id' => $order_id, 'current_user' => '' ) ) ) {
				$resp['e'][] = sprintf( __( 'The zone [%s] does not have enough available tickets.', 'qsot-seating' ), is_object( $zone ) ? $zone->name : 'unknown');
				continue;
			}

			// create the interst
			$res = apply_filters( 'qsot-zoner-interest', false, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => 1, 'order_id' => $order_id ) );
			$success = false;
			if ( ! is_wp_error( $res ) ) {
				$success = $res ? true : false;
				$resp['s'] = $success ? true : $resp['s'];
			} else {
				$resp['e'] = array_merge( $resp['e'], $res->get_error_messages() );
			}

			// craft a repsonse the ui knows how to use
			$resp['r'][] = array(
				'z' => $item['z'],
				't' => 0,
				'q' => 1,
				's' => $success,
				'c' => apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'force' => true, 'order_id' => $order_id, 'current_user' => '' ) ),
			);
		}
		return $resp;
	}

	// process a reserve request for the admin ajax
	public static function aj_reserve( $resp ) {
		// make sure there is a list of zones to reserve
		if ( ! isset( $_POST['items'] ) || ! is_array( $_POST['items'] ) ) {
			$resp['e'] = array( __( 'You must select some zones.', 'qsot-seating' ) );
			return $resp;
		}

		$event_id = (int)$_POST['ei'];
		$resp['e'] = $resp['r'] = array();
		$order_id = (int)$_POST['oid'];
		$coiid = isset( $_POST['coiid'] ) ? (int)$_POST['coiid'] : 0;

		// if no event_id or order_id is present, then fail
		if ( $event_id <= 0 || $order_id <= 0 ) {
			$resp['e'] = array( __( 'Some of the required information is missing from your request.', 'qsot-seating' ) );
			return $resp;
		}

		// for each zone that a reserve is requested for
		foreach ( $_POST['items'] as $item ) {
			$item['z'] = (int)$item['z'];
			$item['t'] = (int)$item['t'];
			$item['q'] = (int)$item['q'];

			// verify that this zone is part of the event we are talking about
			if ( ! apply_filters( 'qsot-zoner-is-zone-for-event', false, $item['z'], $event_id ) ) {
				$resp['e'][] = sprintf( __( 'The specified zone is not available for this event. [%s]', 'qsot-seating' ), $item['z'] );
				continue;
			}

			// validate the zone actually exists and that the selected price is valid for the zone
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['z'] );
			if ( ! apply_filters( 'qsot-price-valid-for-event-zone', false, $item['t'], $event_id, $item['q'] ) ) {
				$resp['e'][] = sprintf( __( 'The price you selected is not valid for the [%s] zone.', 'qost-seating' ), $zone->name );
				continue;
			}

			// make sure that there are enough seats to acccommodate the request
			if ( ! ( $avail = apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'order_id' => $order_id, 'current_user' => '' ) ) ) ) {
				$resp['e'][] = sprintf( __( 'The zone [%s] does not have enough available tickets.', 'qsot-seating' ), is_object( $zone ) ? $zone->name : 'unknown');
				$resp['r'][] = array(
					'z' => $item['z'],
					't' => $item['t'],
					'q' => $item['q'],
					's' => false,
					'c' => $available,
				);
				continue;
			}

			// add the 'confirmed' record for the request
			$res = apply_filters( 'qsot-zoner-confirmed', false, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $item['q'], 'ticket_type_id' => $item['t'], 'order_id' => $order_id ) );
			$success = false;
			if ( ! is_wp_error( $res ) ) {
				if ( empty( $coiid ) ) {
					// add / update the order item
					$resp['oiid'] = $oiid = apply_filters( 'qsot-seating-admin-update-order-item', 0, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $item['q'], 'ticket_type_id' => $item['t'], 'order_id' => $order_id ) );

					// if the order item update was a success, then update our reservation row with the oiid, and mark the process as a success
					if ( $oiid > 0 ) {
						apply_filters(
							'qsot-zoner-update-reservation',
							false,
							array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $item['q'], 'ticket_type_id' => $item['t'], 'order_id' => $order_id, 'state' => self::$o->{'z.states.c'} ),
							array( 'order_item_id' => $oiid )
						);
						$success = $res ? true : false;
						$resp['s'] = $success ? true : $resp['s'];
					} else {
						$resp['s'] = false;
					}
				} else {
					// remove the old coiid record
					apply_filters( 'qsot-zoner-update-reservation', false, array( 'order_item_id' => $coiid ), array( '_delete' => true, 'qty' => 0 ) );

					// update the new record with the old coiid
					apply_filters(
						'qsot-zoner-update-reservation',
						false,
						array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $item['q'], 'ticket_type_id' => $item['t'], 'order_id' => $order_id, 'state' => self::$o->{'z.states.c'} ),
						array( 'order_item_id' => $coiid )
					);

					// update the order item to reflect the new changes
					apply_filters( 'qsot-seating-admin-update-order-item', $coiid, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $item['q'], 'ticket_type_id' => $item['t'], 'order_id' => $order_id ) );

					$success = $res ? true : false;
					$resp['s'] = $success ? true : $resp['s'];
				}
			} else {
				$resp['e'] = array_merge( $resp['e'], $res->get_error_messages() );
			}

			// construct a response that describes the results in a way that the ui knows how to use it
			$resp['r'][] = array(
				'z' => $item['z'],
				't' => $item['t'],
				'q' => $item['q'],
				's' => $success,
				'c' => apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'force' => true, 'order_id' => $order_id, 'current_user' => '' ) ),
			);
		}
		return $resp;
	}

	public static function aj_remove( $resp ) {
		if ( ! isset( $_POST['items'] ) || ! is_array( $_POST['items'] ) ) {
			$resp['e'] = array( __( 'You must select some zones.', 'qsot-seating' ) );
			return $resp;
		}

		$event_id = (int)$_POST['ei'];
		$resp['e'] = $resp['r'] = array();
		$order_id = (int)$_POST['oid'];

		$raw_owns = apply_filters( 'qsot-zoner-ownerships-current-user', array(), array( 'event' => $event_id ) );
		$ownerships = array();
		foreach ( $raw_owns as $st => $group ) {
			$ownerships[ $st ] = array();
			foreach ( $group as $item ) {
				if ( ! isset( $ownerships[ $st ][ $item->zone_id . '' ] ) ) $ownerships[ $st ][ $item->zone_id . '' ] = array();
				if ( ! isset( $ownerships[ $st ][ $item->zone_id . '' ][ $item->ticket_type_id . '' ] ) ) $ownerships[ $st ][ $item->zone_id . '' ][ $item->ticket_type_id . '' ] = array();
				$ownerships[ $st ][ $item->zone_id . '' ][ $item->ticket_type_id . '' ][] = $item;
			}
		}

		foreach ( $_POST['items'] as $item ) {
			$item['z'] = (int)$item['z'];
			$item['t'] = (int)$item['t'];
			$item['st'] = 'r' == $item['st'] ? self::$o->{'z.states.r'} : self::$o->{'z.states.i'};

			if ( ! apply_filters( 'qsot-zoner-is-zone-for-event', false, $item['z'], $event_id ) ) {
				$resp['e'][] = sprintf( __( 'The specified zone is not available for this event. [%s]', 'qsot-seating' ), $item['z'] );
				continue;
			}
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['z'] );

			if ( ! isset( $ownerships[ $item['st'] ][ $item['z'] . '' ][ $item['t'] . '' ] ) || empty( $ownerships[ $item['st'] ][ $item['z'] . '' ][ $item['t'] . '' ] ) ) {
				$resp['e'][] = sprintf( __( 'You do not own any tickets for %s that are marked [%s].', 'qsot-seating' ), $zone->name, $item['st'] );
				continue;
			}

			$res = apply_filters( 'qsot-zoner-' . $item['st'], false, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => 0, 'ticket_type_id' => $item['t'] ) );
			$success = false;
			if ( ! is_wp_error( $res ) ) {
				$success = $res ? true : false;
				$resp['s'] = $success ? true : $resp['s'];
			} else {
				$resp['e'] = array_merge( $resp['e'], $res->get_error_messages() );
			}
			$resp['r'][] = array(
				'z' => $item['z'],
				't' => $item['t'],
				'q' => 0,
				's' => $success,
				'c' => apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'force' => true, 'order_id' => $order_id, 'current_user' => '' ) ),
			);
		}
		return $resp;
	}

	// add or update an existing order item for a reservation
	public static function update_order_item( $oiid, $args ) {
		// normalize the passed args
		$args = wp_parse_args( $args, array(
			'event' => 0,
			'zone_id' => 0,
			'count' => 0,
			'ticket_type_id' => 0,
			'order_id' => 0,
		) );

		// if we are missing seemingly valid ids, then fail
		if ( $args['order_id'] < 0 || $args['event'] < 0 || $args['ticket_type_id'] < 0 ) return $oiid;

		// test if the order is valid, and load the order for later use
		$order = wc_get_order( $args['order_id'] );

		if ( ! is_object( $order ) || $args['order_id'] != $order->id ) return $oiid;

		// test if the product is valid, and load it for later use
		$_product = wc_get_product( $args['ticket_type_id'] );

		if ( ! is_object( $_product ) ) return $oiid;

		// attempt to find any existing item that matches the requested item update
		$order_item_id = $oiid;
		if ( empty( $order_item_id ) ) {
			foreach ( $order->get_items() as $id => $item ) {
				if (
					isset( $item['item_meta']['product_id'] ) &&$args['ticket_type_id'] == $item['item_meta']['product_id'] &&
					isset( $item['item_meta']['event_id'] ) && $args['event'] == $item['item_meta']['event_id'] &&
					isset( $item['item_meta']['zone_id'] ) && $args['zone_id'] == $item['item_meta']['zone_id']
				) {
					$order_item_id = $id;
					break;
				}
			}
		}

		// if there is no matching existing item
		if ( empty( $order_item_id ) ) {
			// and if the requested quantity is greater than 0
			if ( $args['count'] > 0 ) {
				// create a new item and assign the appropriate meta for the ticket
				$order_item_id = $order->add_product( $_product, $args['count'] );
				wc_update_order_item_meta( $order_item_id, '_event_id', $args['event'] );
				wc_update_order_item_meta( $order_item_id, '_zone_id', $args['zone_id'] );
			}
		// if there is a matching existing item
		} else {
			// if the quantity requested is 0, then delete the item
			if ( $args['count'] <= 0 ) {
				wc_delete_order_item( $order_item_id );
			// otherwise, if the quantity is positive, then update the quantity of the existing item
			} else {
				// update the order item product data in case it changed
				wc_update_order_item_meta( $order_item_id, '_product_id', $args['ticket_type_id'] );
				wc_update_order_item( $order_item_id, array( 'order_item_name' => $_product->get_title() ) );

				// update the order item data now that the product is correct
				$order->update_product( $order_item_id, $_product, array( 'qty' => $args['count'] ) );
				if ( ! empty( $args['event'] ) )
					wc_update_order_item_meta( $order_item_id, '_event_id', $args['event'] );
				if ( ! empty( $args['zone_id'] ) )
					wc_update_order_item_meta( $order_item_id, '_zone_id', $args['zone_id'] );
			}
		}

		// return the final order item id
		return $order_item_id;
	}
}

if ( defined( 'ABSPATH' ) && function_exists( 'add_action' ) )
	QSOT_seating_order_admin::pre_init();
