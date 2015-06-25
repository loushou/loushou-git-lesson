<?php (__FILE__ == $_SERVER['SCRIPT_FILENAME']) ? die(header('Location: /')) : null;

class QSOT_seating_core {
	protected static $o = null;
	protected static $options = null;

	public static function pre_init() {
		// opentickets core settings class
		$settings_class_name = apply_filters( 'qsot-settings-class-name', '' );
		if ( ! empty( $settings_class_name ) ) {
			self::$o = call_user_func_array(array($settings_class_name, "instance"), array());

			// load all the options, and share them with all other parts of the plugin
			$options_class_name = apply_filters( 'qsot-options-class-name', '' );
			if ( ! empty( $options_class_name ) ) {
				self::$options = call_user_func_array( array( $options_class_name, "instance" ), array() );
				self::_setup_admin_options();
			}

			self::$o->seating = array(
				'mk' => array(
					'struct' => '_pricing_struct_id',
				),
			);

			// register scripts and styles for this class
			add_action( 'init', array( __CLASS__, 'register_assets' ), 10000 );

			// when activating this plugin, change the post stati of the existing qsot-event-area post type, which we will be taking over
			add_action( 'qsot-seating-activation', array( __CLASS__, 'on_activation' ), 100 );

			// seating chart zone functions
			add_filter( 'qsot-get-seating-zones', array( __CLASS__, 'get_seating_zones' ), 10, 3 );
			add_filter( 'qsot-update-seating-zones', array( __CLASS__, 'update_seating_zones' ), 10, 4 );

			if ( true || QSOT_addon_registry::instance()->is_activated( QSOT_multi_price_launcher::me() ) ) {
				// register the seating post type
				add_filter( 'qsot-events-core-post-types', array( __CLASS__, 'register_post_type' ), 10000 );
			}

			// add the seating information to the seating chart load process
			// DO NOT add the zones when loading the event area information on an event, because it slows down the calendar dramatically
			//add_filter('qsot-get-event-area', array(__CLASS__, 'get_event_area_by_id'), 100, 2);

			// when loading an event, load the seating information, as well as the availability information
			add_filter( 'qsot-get-event', array( __CLASS__, 'add_ea_availability_to_event', ), 1000, 2 );

			// setup the new tables for the zones
			global $wpdb;

			$wpdb->qsot_seating_zones = $wpdb->prefix . 'qsot_seating_zones';
			$wpdb->qsot_seating_zonemeta = $wpdb->prefix . 'qsot_seating_zonemeta';

			// reuse the GAMP pricing tables
			$wpdb->qsot_price_structs = $wpdb->prefix . 'qsot_price_structures';
			$wpdb->qsot_price_struct_prices = $wpdb->prefix . 'qsot_price_structure_prices';

			add_filter( 'qsot-upgrader-table-descriptions', array( __CLASS__, 'setup_tables' ), 10000 );

			// pricing structure functions
			add_filter( 'qsot-get-price-structures', array( __CLASS__, 'get_price_structures' ), 10, 2 );
			add_filter( 'qsot-get-price-structure-prices', array( __CLASS__, 'get_price_structure_prices' ), 10, 2 );
			add_action( 'qsot-update-seating-pricing', array( __CLASS__, 'update_price_structure' ), 10, 3 );
			add_filter( 'qsot-price-valid-for-event-zone', array( __CLASS__, 'is_price_valid_for_event_zone' ), 10, 4 );

			// change out the assets that are loaded for the event ui
			add_action( 'qsot-frontend-event-assets', array( __CLASS__, 'load_frontend_assets' ), 15 );
			add_filter( 'qsot-seating-frontend-templates', array( __CLASS__, 'frontend_templates' ), 20, 2 );
			add_filter( 'qsot-seating-frontend-msgs', array( __CLASS__, 'frontend_msgs' ), 20, 2 );

			// handle ajax calls using the new ui
			add_action( 'wp_ajax_qsots-ajax', array( __CLASS__, 'handle_frontend_ajax' ), 10 );
			add_action( 'wp_ajax_nopriv_qsots-ajax', array( __CLASS__, 'handle_frontend_ajax' ), 10 );

			add_filter( 'qsots-ajax-int', array( __CLASS__, 'aj_interest' ), 10, 2 );
			add_filter( 'qsots-ajax-res', array( __CLASS__, 'aj_reserve' ), 10, 2 );
			add_filter( 'qsots-ajax-rm', array( __CLASS__, 'aj_remove' ), 10, 2 );

			// remove core actions so they can be replaced
			add_filter( 'wp_loaded', array( __CLASS__, 'remove_core_actions' ), 1 );

			// replace core actions
			add_filter( 'qsot-zoner-reserved-current-user', array( __CLASS__, 'reserve_current_user' ), 100, 4 );
			add_filter( 'qsot-zoner-interest-current-user', array( __CLASS__, 'interest_current_user' ), 0, 4 );
			add_action( 'woocommerce_cart_item_removed', array( __CLASS__, 'upon_cart_remove_item' ), 5, 2 );
			add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'order_status_changed' ), 100, 3 );
			add_action( 'woocommerce_add_order_item_meta', array( __CLASS__, 'update_ticket_order_information' ), 100000, 3 );
			add_action( 'qsot-draw-event-area-image', array( __CLASS__, 'draw_event_area_image' ), 100, 3 );

			// item displays
			add_action( 'woocommerce_get_item_data', array( __CLASS__, 'add_zone_name_to_cart' ), 10, 2 );

			// add zone to ticket display
			add_action( 'qsot-ticket-information', array( __CLASS__, 'ticket_zone_display' ), 10000, 2 );
			add_filter( 'qsot-compile-ticket-info', array( __CLASS__, 'compile_ticket_info' ), 10000, 3 );
		}
	}

	// remove the core actions so that they can be replaced with new versions that include zone_id
	public static function remove_core_actions() {
		remove_filter( 'qsot-zoner-reserve-current-user', array( 'qsot_seat_pricing', 'reserve_current_user' ), 100 );
		remove_action( 'woocommerce_cart_item_removed', array( 'qsot_seat_pricing', 'upon_cart_remove_item' ), 5 );
		remove_action( 'woocommerce_before_cart_item_quantity_zero', array( 'qsot_seat_pricing', 'delete_cart_ticket' ), 10 );

		remove_action( 'qsot-draw-event-area-image', array( 'qsot_event_area', 'draw_event_area_image' ), 100 );

		remove_action( 'woocommerce_order_status_changed', array( 'qsot_seat_pricing', 'order_status_changed'), 100 );
		global $wp_filter;
		// if the version of OTCE does not separate the cancel and permanent status changes into separate checks, then add one for cancel
		if ( ! isset( $wp_filter['woocommerce_order_status_changed']['101'], $wp_filter['woocommerce_order_status_changed']['101']['qsot_seat_pricing::order_status_changed_cancel'] ) )
			add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'order_status_changed_cancel' ), 101, 3 );
		remove_action( 'woocommerce_add_order_item_meta', array( 'qsot_seat_pricing', 'update_ticket_order_information' ), 100000 );
	}

	// register the required js and css files
	public static function register_assets() {
		// version used for js and css files, to prevent 'caching' problems
		$version = QSOT_seating_launcher::version();
		// base url to our plugin assets
		$url = QSOT_seating_launcher::plugin_url() . 'assets/';
		// if script debugging is on, then use the un minified version of certain assets
		$debug = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min';

		//wp_register_script( 'kineticjs', $url . 'js/libs/kineticjs/kinetic-v5.1.0' . $debug . '.js', array(), 'v5.1.0' );

		// svg lib
		wp_register_script( 'snapsvg', $url . 'js/libs/snapsvg/snap.svg' /*. $debug */. '.js', array(), 'v0.3.0' );
		// additional tools to use, similar to core OTCE tools.js
		wp_register_script( 'qsot-seating-tools', $url . 'js/utils/tools.js', array( 'qsot-tools', 'jquery-ui-dialog' ), $version );
		// core loader for our scripts needed on the frontend
		wp_register_script( 'qsot-seating-loader', $url . 'js/frontend/loader.js', array( 'qsot-seating-tools', 'jquery-color' ), $version );

		// frontend seating ui
		wp_register_script( 'qsot-seating-frontend-ui', $url . 'js/frontend/ui.js', array( 'qsot-seating-tools' ), $version );
		wp_register_style( 'qsot-seating-frontend-ui', $url . 'css/frontend/ui.css', array( 'qsot-event-frontend' ), $version );
	}

	public static function load_frontend_assets( $post ) {
		if ( ! is_object( $post ) ) return;

		// base url to our plugin assets
		$url = QSOT_seating_launcher::plugin_url() . 'assets/';
		$debug = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min';

		$event = apply_filters( 'qsot-get-event', $post, $post );
		$ticket_id = is_object( $event->meta ) && is_object( $event->meta->_event_area_obj ) && is_object( $event->meta->_event_area_obj->ticket )
				? $event->meta->_event_area_obj->ticket->id
				: 0;

		wp_dequeue_script('qsot-event-frontend');

		wp_enqueue_style( 'qsot-seating-frontend-ui' );
		wp_enqueue_script( 'qsot-seating-loader' );

		$args = array(
			'assets' => array(
				'snap' => $url . 'js/libs/snapsvg/snap.svg' /*. $debug */ . '.js',
				'svg' => $url . 'js/frontend/ui.js',
				'nosvg' => $url . 'js/frontend/ui-nosvg.js',
				'res' => $url . 'js/frontend/reservations.js',
			),
			'nonce' => wp_create_nonce( 'qsot-frontend-seat-selection-' . $event->ID ),
			'options' => array(
				'one-click' => 'yes' == self::$options->{'qsot-seating-one-click-single-price'},
			),
			'ajaxurl' => admin_url( 'admin-ajax.php' ),
			'templates' => apply_filters( 'qsot-seating-frontend-templates', array(), $event ),
			'messages' => apply_filters( 'qsot-seating-frontend-msgs', array(), $event ),
			'edata' => false,
			'owns' => false,
		);

		if ( apply_filters( 'qsot-can-sell-tickets-to-event', false, $event->ID ) ) {
			$args['edata'] = self::frontend_edata( $event );
			$args['owns'] = self::owns_for_frontend( apply_filters( 'qsot-zoner-ownerships-current-user', array(), $event->ID, 0, false ), $event );
		}

		wp_localize_script( 'qsot-seating-loader', '_qsot_seating_loader', $args );
	}

	// create a list of this user's ownerships for the frontend ui
	public static function owns_for_frontend( $owns, $event ) {
		if ( empty( $owns ) ) return array();
		$out = array();
		
		// reorganize the supplied list so that it can be used by the frontend
		foreach ( $owns as $status => $list ) {
			$new_list = array();
			// for each ticket in this status list
			foreach ( $list as $item ) {
				if ( ! is_object( $item ) ) continue;
				// create a record that the frontend will understand
				$new_list[] = array(
					's' => 1,
					'z' => $item->zone_id,
					't' => $item->ticket_type_id,
					'q' => $item->quantity,
					'c' => apply_filters( 'qsot-zoner-get-event-zone-available', 0, $item->zone_id, $event->ID ),
				);
			}
			if ( ! empty( $new_list ) ) $out[ $status ] = $new_list;
		}

		return $out;
	}

	// strip down and organize the relevant event data so that it can be used on the frontend
	public static function frontend_edata( $event ) {
		// get a list of all the zones and zoom-zones for this event
		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );
		$zzones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 2 );

		// get a list of all the availabilities for the zones in this event
		$stati = self::_calc_zone_stati( $zones, $event );

		// load the pricing table for the event
		$pricing = self::_get_event_pricing( $event->ID );
		$ticket_types = array();
		// aggregate a unique list of ticket types from the pricing table
		if ( isset( $pricing, $pricing->prices ) && is_array( $pricing->prices ) )
			foreach ( $pricing->prices as $group => $products )
				foreach ( $products as $product )
					$ticket_types[ $product['product_id'] ] = $product;

		// put it all together in a format that the frontend will understand
		$out = array(
			'id' => $event->ID,
			'name' => apply_filters( 'the_title', $event->post_title ),
			'ticket' => false,
			'link' => get_permalink( $event->ID ),
			'parent_link' => get_permalink( $event->post_parent ),
			'ps' => ( isset( $pricing, $pricing->prices ) && is_array( $pricing->prices ) ) ? $pricing->prices : array(),
			'tts' => $ticket_types,
			'capacity' => $event->meta->capacity,
			'available' => $event->meta->available,
			'zones' => self::_remove_unneeded_zone_data( $zones ),
			'zzones' => self::_remove_unneeded_zone_data( $zzones ),
		);
		$out['zone_count'] = count( $out['zones'] );
		$out['tt_count'] = count( $out['tts'] );
		$out['stati'] = $stati;

		return apply_filters( 'qsoti-seating-frontend-event-data', $out, $event );
	}

	// determine the status of each zone in the zone list, based on capacity and total reservations
	protected static function _calc_zone_stati( $zones, $event ) {
		$out = array();
		// aggregate the capacity of each zone
		foreach ( $zones as $zone )
			if ( isset( $zone->id, $zone->capacity ) )
				$out[ $zone->id . '' ] = array( (int)$zone->capacity, (int)$zone->capacity );
		
		// get a condensed list of all reservations for the event
		$all_claimed = apply_filters( 'qsot-zoner-event-zone-reservations', array(), array( 'event' => $event ) );

		// subtract all reservations from the capacities from above to create a final availability number
		foreach ( $all_claimed as $zid => $total )
			if ( isset( $out[ $zid . '' ] ) )
				$out[ $zid . '' ][1] = max( 0, $out[ $zid . '' ][1] - $total );

		// testing only
		//foreach ( $out as $z => $rem ) if ( rand( 0, 1 ) ) $out[ $z ] = 0;

		return $out;
	}

	// remove data from the frontend zone output, because it is not used
	protected static function _remove_unneeded_zone_data( $zones ) {
		foreach ( $zones as &$zone ) {
			unset( $zone->seating_chart_id, $zone->capacity, $zone->meta['image-id'] );
		}
		return $zones;
	}

	// compile a list of all the messages that the frontend could generate, and allow them to be translateable
	public static function frontend_msgs( $current, $event ) {
		$current = is_array( $current ) ? $current : array();

		$current['Available'] = __( 'Available', 'qsot-seating' );
		$current['Available (%s)'] = __( 'Available (%s)', 'qsot-seating' );
		$current['Unavailable'] = __( 'Unavailable', 'qsot-seating' );
		$current['Could not show interest in those tickets.'] = __( 'Could not show interest in those tickets.', 'qsot-seating' );
		$current['Could not reserve those tickets.'] = __( 'Could not reserve those tickets.', 'qsot-seating' );
		$current['Could not remove those tickets.'] = __( 'Could not remove those tickets.', 'qsot-seating' );
		$current['Could not load the required components.'] = __( 'Could not load the required components.', 'qsot-seating' );
		$current['Could not load a required component.'] = __( 'Could not load a required component.', 'qsot-seating' );
		$current['You do not have cookies enabled, and they are required.'] = __( 'You do not have cookies enabled, and they are required.', 'qsot-seating' );
		$current['You must have cookies enabled to purchase tickets.'] = __( 'You must have cookies enabled to purchase tickets.', 'qsot-seating' );
		$current['There are not enough %s tickets available.'] = __( 'There are not enough %s tickets available.', 'qsot-seating' );
		$current['Could not reserve a ticket for %s.'] = __( 'Could not reserve a ticket for %s.', 'qsot-seating' );
		$current['Could not remove the tickets for %s.'] = __( 'Could not remove the tickets for %s.', 'qsot-seating' );
		$current['Zoom-In'] = __( 'Zoom-In', 'qsot-seating' );
		$current['Zoom-Out'] = __( 'Zoom-Out', 'qsot-seating' );
		$current['Reset Zoom'] = __( 'Reset Zoom', 'qsot-seating' );
		$current['Button'] = __( 'Button', 'qsot-seating' );
		$current['No SNAPSVG canvas specified. Buttonbar cannot initialize.'] = __( 'No SNAPSVG canvas specified. Buttonbar cannot initialize.', 'qsot-seating' );

		return $current;
	}

	// aggregate a list of all the frontend templates that will be used, and allow them to be changeable via filter
	public static function frontend_templates( $list, $event ) {
		$list = is_array( $list ) ? $list : array();

		global $woocommerce;
		$cart_url = '#';
		if ( is_object( $woocommerce ) && is_object( $woocommerce->cart ) )
			$cart_url = $woocommerce->cart->get_cart_url();

		$max = 1000000;
		if ( is_object( $event->meta ) && is_object( $event->meta->available ) )
			$max = $event->meta->available;

		$list['zone-info-tooltip'] = '<div class="qsot-tooltip"><div class="tooltip-positioner">'
				. '<div class="tooltip-wrap">'
					. '<div class="zone"><span class="qslabel">' . __( 'Name:', 'qsot-seating' ) . '</span> <span class="zone-name value"></span></div>'
					. '<div class="status"><span class="qslabel">' . __( 'Status:', 'qsot-seating' ) . '</span> <span class="status-msg value"></span></div>'
				. '</div>'
			. '</div></div>';

		$list['one-title'] = '<h3>' . __( 'Step 1: Select the price and quantity:', 'qsot-seating' ) . '</h3>';
		$list['two-title'] = '<h3>' . __( 'Step 2: Adjust or Review:', 'qsot-seating' ) . '</h3>';

		$list['msg-block'] = '<div class="ticket-ui-msgs" rel="msgs">'
				. '<div class="inner error" rel="errors"></div>'
				. '<div class="inner confirm" rel="confirms"></div>'
			. '</div>';

		$list['ticket-selection'] = '<div class="ticket-form ticket-selection-section">'
				. '<div class="form-inner">'
					. '<div class="title-wrap">'
						. '<div class="form-title" rel="title"></div>'
					. '</div>'
					. '<div rel="owns"></div>'
					. '<div class="selection-nosvg" rel="nosvg"></div>'
				. '</div>'
				. '<div class="actions" rel="actions">'
					. '<a href="' . esc_attr( $cart_url ) . '" class="button" rel="cart-btn">' . __( 'Proceed to Cart', 'qsot-seating' ) . '</a>'
				. '</div>'
			. '</div>';

		$list['sel-nosvg'] = '<div class="field">'
				. '<label class="section-heading">' . __( 'Reserve some tickets:', 'qsot-seating' ) . '</label>'
				. '<div class="availability-message helper"></div>'
				. '<span rel="tt_edit"></span>'
				. '<input type="number" step="1" min="0" max="' . $max. '" rel="qty" name="quantity" value="1" class="very-short" />'
				. '<input type="button" value="' . __( 'Reserve', 'qsot-seating' ) . '" rel="reserve-btn" class="button reserve-btn" />'
			. '</div>';

		$list['owns-wrap'] = '<div class="owns-wrap field" rel="owns-wrap">'
				. '<label class="section-heading">' . __( 'Your current reservations are:', 'qsot-seating' ) . '</label>'
				. '<div class="owns-list" rel="owns-list"></div>'
				. '<input type="button" value="' . __( 'Update', 'qsot-seating' ) . '" rel="update-btn" class="button update-btn" />'
			. '</div>';

		$list['interest-item'] = '<div class="item" rel="interest-item">'
				. '<a href="#" class="remove-link" rel="remove-btn">X</a>'
				. '<span class="pending">' . __( 'Pending', 'qsot-seating' ) . ' </span>'
				. '<span rel="tt_display"></span> '
				. '<input type="hidden" name="zone[]" value="" rel="zone" />'
				. '<input type="hidden" name="ticket-type[]" value="" rel="ticket-type" />'
				. '<input type="button" value="' . __( 'Pending', 'qsot-seating' ) . '" class="button continue-btn" rel="continue-btn" />'
			. '</div>';

		$list['owns'] = '<div class="item" rel="own-item">'
				. '<a href="#" class="remove-link" rel="remove-btn">X</a>'
				. '<span rel="tt_display"></span>'
				. '<span rel="qty_display"> x <span rel="quantity"></span></span>'
				. '<input type="hidden" name="zone[]" value="" rel="zone" />'
				. '<input type="hidden" name="ticket-type[]" value="" rel="ticket-type" />'
				. '<input type="hidden" name="quantity[]" value="1" rel="qty" />'
			. '</div>';

		$list['owns-multiple'] = '<div class="item multiple" rel="own-item">'
				. '<a href="#" class="remove-link" rel="remove-btn">X</a>'
				. '<span rel="tt_display"></span>'
				. '<input type="hidden" name="ticket-type[]" value="" rel="ticket-type" />'
				. '<input type="number" step="1" min="0" max="' . $max. '" rel="qty" name="quantity[]" value="1" class="very-short" />'
			. '</div>';

		$list['tt-display'] = '<span class="ticket-description">'
				. '<span class="zone-wrap">[<span class="zone" rel="zone-name"></span>] </span>'
				. '<span class="name" rel="ttname"></span> '
				. '(<span class="price" rel="ttprice"></span>)'
			. '</span>';

		$list['zone-select'] = '<select name="zone-select" rel="zone-select"></select>';
		$list['zone-option'] = '<option value="" class="zone-option"></option>';
		$list['zone-single'] = '<span class="zone-name-wrap">'
				. '<input type="hidden" name="zone" value="" rel="zone" />'
				. '<span class="zone-name" rel="name"></span>'
			. '</span>';

		$list['tt-select'] = '<select name="ticket-type" rel="ticket-type"></select>';
		$list['tt-option'] = '<option value="" class="ttcombo"></option>';
		$list['tt-single'] = '<span class="ticket-type-wrap">'
				. '<input type="hidden" name="ticket-type" value="" rel="ticket-type" />'
				. '<span class="name" rel="ttname"></span>'
				. '<span class="price" rel="ttprice"></span>'
			. '</span>';

		$list['helper:available'] = '<span>' . sprintf( __( 'There are currently %s tickets available.', 'qsot-seating' ), '<span class="available"></span>' ) . '</span>';
		$list['helper:more-available'] = '<span>' . sprintf( __( 'There are currently %s more tickets available.', 'qsot-seating' ), '<span class="available"></span>' ) . '</span>';

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

		$list['loading'] = '<div class="qsots-loading"><div class="inner"><div class="inner-inner"><div class="msg">' . __( 'Loading. On moment please...', 'qsot-seating' ) . '</div></div></div></div>';
		
		return $list;
	}

	// rename the event_area post type to be more appropriately named with the seating extension
	public static function register_post_type( $post_types ) {
		$pt = self::$o->{'event_area.post_type'};
		// if the event_area post type exists
		if ( isset( $post_types[$pt] ) ) {
			// re-label it
			$post_types[$pt]['label_replacements'] = array(
				'plural' => __( 'Seating Charts', 'qsot' ),
				'singular' => __( 'Chart', 'qsot' ),
			);
			// open up the admin UI pages for it
			$post_types[$pt]['args']['show_ui'] = true;
			// enable relevant features on this post type
			$post_types[$pt]['args']['supports'] = isset( $post_types[$pt]['args']['supports'] ) && is_array( $post_types[$pt]['args']['supports'] ) && ! empty( $post_types[$pt]['args']['supports'] )
				? array_diff( $post_types[$pt]['args']['supports'], array( 'editor' ) )
				: array( 'title' );
		}

		return $post_types;
	}

	// draw the event area image, for any event that has an image defined
	public static function draw_event_area_image( $event, $area=false, $reserved=array() ) {
		// if the event is not valid, then dont even attempt to show anything
		if ( ! is_object( $event ) || ! isset( $event->ID ) )
			return;

		// if the event is not passed, and it has zones, then skip this also, because the seating chart will show this image already
		if ( apply_filters( 'qsot-can-sell-tickets-to-event', false, $event->ID ) && isset( $event->zones ) && ! empty( $event->zones ) )
			return;

		// if the event_area was not passed, then attempt to loaded it from the event
		if ( ! is_object( $area ) || ! isset( $area->ID ) ) {
			$ea_id = (int)get_post_meta( $event->ID, self::$o->{'meta_key.event_area'}, true );
			if ( $ea_id <= 0 )
				return;
			$area = get_post( $ea_id );
		// if it was passed, then fetch the id
		} else {
			$ea_id = $area->ID;
		}

		// first attempt to get the featured image as the event area image
		$thumb_id = (int)get_post_meta( $ea_id, self::$o->{'event_area.mk.img'}, true );

		// if there was not a featured image and if the event has zones, check all the zones, in zindex order from lowest to highest, for the first bgimage defined
		if ( $thumb_id <= 0 && isset( $event->zones ) && is_array( $event->zones ) ) {
			$images_ordered = array();
			// get a list of all BG images in the seating chart
			foreach ( $event->zones as $zone )
				if ( isset( $zone->meta, $zone->meta['_type'], $zone->meta['_order'], $zone->meta['image-id'], $zone->meta['bg'] ) && 'image' == $zone->meta['_type'] && $zone->meta['bg'] && $zone->meta['image-id'] > 0 )
					$images_ordered[ $zone->meta['_order'] ] = $zone->meta['image-id'];

			// if there are any images
			if ( count( $images_ordered ) ) {
				// sort them by their zindex
				ksort( $images_ordered, SORT_NUMERIC );
				// use the lowest zindex image as the bg image
				$thumb_id = current( $images_ordered );
			}
		}

		if ( $thumb_id > 0 ) {
			list( $thumb_url, $w, $h, $rs ) = wp_get_attachment_image_src( $thumb_id, 'full' );
			if ( $thumb_url ) {
				?>
				<div class="event-area-image-wrap">
					<img src="<?php echo esc_attr( $thumb_url ) ?>" class="event-area-image" alt="Image of the <?php echo esc_attr( apply_filters( 'the_title', $area->post_title ) ) ?>" />
				</div>
				<?php
			}
		}
	}

	// generic function designed to handle the ajax requests from the frontend
	public static function handle_frontend_ajax() {
		$resp = array( 's' => false );

		// validate the request
		if ( isset( $_POST['n'], $_POST['ei'], $_POST['sa'] ) && wp_verify_nonce( $_POST['n'], 'qsot-frontend-seat-selection-' . ( (int)$_POST['ei'] ) ) ) {
			$sa = $_POST['sa'];

			// call the ajax filter to handle the actual request
			if ( has_action( 'qsots-ajax-' . $sa ) )
				$resp = apply_filters( 'qsots-ajax-' . $sa, $resp, $sa );

			// add an 'all' filter, in case others want to extend this ability
			if ( has_action( 'qsots-ajax-all' ) )
				$resp = apply_filters( 'qsots-ajax-all', $resp, $sa );
		// if the request does not validate, at least say something in return
		} else {
			$resp['e'] = array( __( 'An unexpected error has occurred.', 'qsot-seating' ) );
		}

		// respond
		echo @json_encode( $resp );
		exit;
	}

	// handle ajax requests to make an 'interest' reservation entry for a zone
	public static function aj_interest( $resp ) {
		// validate that at least one zone has been requested to be interested
		if ( ! isset( $_POST['items'] ) || ! is_array( $_POST['items'] ) ) {
			$resp['e'] = array( __( 'You must select some zones.', 'qsot-seating' ) );
			return $resp;
		}

		$event_id = (int)$_POST['ei'];
		$event = apply_filters( 'qsot-get-event', false, $event_id );
		if ( ! is_object( $event ) ) {
			$resp['e'] = array( __( 'That event does not exist.', 'qsot-seating' ) );
			return $resp;
		}

		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );
		$resp['e'] = $resp['r'] = array();

		// for each zone that needs and interest
		foreach ( $_POST['items'] as $item ) {
			$q = isset( $item['q'] ) && $item['q'] > 0 ? (int)$item['q'] : 1;
			// validate that this zone is actually part of the requested event
			if ( ! apply_filters( 'qsot-zoner-is-zone-for-event', false, (int)$item['z'], $event_id ) ) {
				$resp['e'][] = sprintf( __( 'The specified zone is not available for this event. [%s]', 'qsot-seating' ), $item['z'] );
				continue;
			}

			// make sure this zone has available tickets
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['z'] );
			if ( 0 == $item['z'] ) $zone->capacity = self::$o->{'meta_key.capacity'};
			if ( ! ( $available = apply_filters( 'qsot-zoner-get-event-zone-available', false, (int)$item['z'], $event_id ) ) ) {
				$resp['e'][] = sprintf( __( 'The zone [%s] does not have enough available tickets.', 'qsot-seating' ), is_object( $zone ) ? $zone->name : 'unknown');
				continue;
			}
			$q = min( $q, $available );

			// actually process the interest request for this zone
			$res = apply_filters( 'qsot-zoner-interest-current-user', false, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $q ) );
			$success = false;
			// parse the results of the request, and create an appropriate response for the frontend
			if ( ! is_wp_error( $res ) ) {
				$success = $res ? true : false;
				$resp['s'] = $success ? true : $resp['s'];
			} else {
				$resp['e'] = array_merge( $resp['e'], $res->get_error_messages() );
			}
			$resp['r'][] = array(
				'z' => $item['z'],
				't' => 0,
				'q' => $q,
				's' => $success,
				'c' => apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'force' => true ) ),
			);
		}
		return $resp;
	}

	public static function aj_reserve( $resp ) {
		if ( ! isset( $_POST['items'] ) || ! is_array( $_POST['items'] ) ) {
			$resp['e'] = array( __( 'You must select some zones.', 'qsot-seating' ) );
			return $resp;
		}

		$event_id = (int)$_POST['ei'];
		$resp['e'] = $resp['r'] = array();

		foreach ( $_POST['items'] as $item ) {
			$item['z'] = (int)$item['z'];
			$item['t'] = (int)$item['t'];
			$item['q'] = (int)$item['q'];

			if ( ! apply_filters( 'qsot-zoner-is-zone-for-event', false, $item['z'], $event_id ) ) {
				$resp['e'][] = sprintf( __( 'The specified zone is not available for this event. [%s]', 'qsot-seating' ), $item['z'] );
				continue;
			}
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['z'] );

			if ( ! apply_filters( 'qsot-price-valid-for-event-zone', false, $item['t'], $event_id, $item['z'] ) ) {
				$resp['e'][] = sprintf( __( 'The price you selected is not valid for the [%s] zone.', 'qost-seating' ), $zone->name );
				continue;
			}

			if ( ! ( $avail = apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id ) ) ) {
				$resp['e'][] = sprintf( __( 'The zone [%s] does not have enough available tickets.', 'qsot-seating' ), is_object( $zone ) ? $zone->name : 'unknown');
				$resp['r'][] = array(
					'z' => $item['z'],
					't' => $item['t'],
					'q' => $item['q'],
					's' => false,
					'c' => $avail,
				);
				continue;
			}

			$res = apply_filters( 'qsot-zoner-reserved-current-user', false, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => $item['q'], 'ticket_type_id' => $item['t'] ) );
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
				'q' => $item['q'],
				's' => $success,
				'c' => apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'force' => true ) ),
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

			$res = apply_filters( 'qsot-zoner-' . $item['st'] . '-current-user', false, array( 'event' => $event_id, 'zone_id' => $item['z'], 'count' => 0, 'ticket_type_id' => $item['t'] ) );
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
				'c' => apply_filters( 'qsot-zoner-get-event-zone-available', false, $item['z'], $event_id, array( 'force' => true ) ),
			);
		}
		return $resp;
	}

	public static function is_price_valid_for_event_zone( $result, $ticket_type_id, $event_id, $zone_id ) {
		$pricing = self::_get_event_pricing( $event_id );
		if ( ! is_object( $pricing ) || ! isset( $pricing->prices ) || ! is_array( $pricing->prices ) ) return false;

		$zone_prices = isset( $pricing->prices[ $zone_id . '' ] ) ? $pricing->prices[ $zone_id . '' ] : $pricing->prices[0];
		$found = false;
		foreach ( $zone_prices as $price ) if ( $price['product_id'] == $ticket_type_id ) {
			$found = true;
			break;
		}

		return $found;
	}

	protected static function _get_event_pricing( $event_id ) {
		$cache = wp_cache_get( 'event-pricing-' . $event_id, 'qsots' );

		if ( ! is_array( $cache ) ) {
			$cache = apply_filters( 'qsot-get-price-structures', array(), array( 'id' => get_post_meta( $event_id, self::$o->{'seating.mk.struct'}, true ), 'single' => true, 'price_sub_group' => '' ) );
			wp_cache_set( 'event-pricing-' . $event_id, $cache, 'qsots' );
		}

		return $cache;
	}

	// when an order is moved into completed, we need to update all reservations that are on the order to be confirmed
	public static function order_status_changed( $order_id, $old_status, $new_status ) {
		// if the order is in one of the approved 'permanent' order statuses, then
		if ( in_array( $new_status, apply_filters( 'qsot-zoner-confirmed-statuses', array( 'on-hold', 'processing', 'completed' ) ) ) ) {
			global $woocommerce;

			// load a copy of the updated order, so that we can gain access to it's various items
			$order = wc_get_order( $order_id );
			
			// for each item in the order
			foreach ( $order->get_items() as $item_id => $item ) {
				// if this item is not a ticket, then skip it
				if ( ! apply_filters( 'qsot-item-is-ticket', false, $item ) )
					continue;

				// aggregate the information about the current reservation entry for this item, that is available
				$where = array(
					'event_id' => $item['event_id'],
					'qty' => $item['qty'],
					// completed or reserved, because we may be going from a confirmed status to a confirmed status.
					// if only reserved is used, then any already confirmed tickets get deleted
					'state' => array( self::$o->{'z.states.r'}, self::$o->{'z.states.c'} ),
					'order_id' => array( 0, $order_id ),
					'order_item_id' => $item_id,
					'ticket_type_id' => $item['product_id'],
				);
				if ( isset( $item['zone_id'] ) )
					$where['zone_id'] = $item['zone_id'];

				// construct the new settings for the reservations 
				$set = array(
					'state' => self::$o->{'z.states.c'},
					'order_id' => $order_id,
					'order_item_id' => $item_id
				);

				// actaully send the request to update teh reservations
				$res = apply_filters( 'qsot-zoner-update-reservation', false, $where, $set );

				// notify plugins of the change
				do_action( 'qsot-confirmed-ticket', $order, $item, $item_id );
			}
		}
	}
	
	// separate function for handling 'cancelled' order status shifts
	public static function order_status_changed_cancel( $order_id, $new_status, $old_status ) {
		// if the order is actually being cancelled, then
		if ( in_array( $new_status, apply_filters( 'qsot-zoner-unconfirm-statuses', array( 'cancelled' ) ) ) ) {
			$order = wc_get_order( $order_id );
			self::_unconfirm_tickets( $order, '*', true, array( 'new_status' => $new_status, 'old_status' => $old_status ) );
		}
	}

	// unconfirm seats that used to be on an order
	protected static function _unconfirm_tickets( $order, $oiids, $modify_meta=false, $modify_meta_extra=array() ) {
		// for each order item
		foreach ( $order->get_items() as $oiid => $item ) {
			// make sure that this order item is one that should be cancelled
			if ( $oiids !== '*' && ( is_array( $oiids ) && ! in_array( absint( $oiid ), $oiids ) ) )
				continue;

			// if this order item is not a ticket, then skip it
			if ( ! apply_filters( 'qsot-item-is-ticket', false, $item ) )
				continue;
			
			// aggregate the information about the reservation to change
			$where = array( 'event_id' => $item['event_id'], 'ticket_type_id' => $item['product_id'], 'order_id' => $order->id, 'qty' => $item['qty'], 'order_item_id' => array( 0, $oiid ) );
			$ostatus = $order->get_status();

			// actaully perform the update that removes the reservations
			$res = apply_filters(
				'qsot-zoner-update-reservation',
				false,
				$where,
				array( 'qty' => 0, '_delete' => true )
			);

			// if we are being asked to modify the meta for these items as well, then do so
			if ( $modify_meta ) {
				$delete_meta = apply_filters( 'qsot-zoner-unconfirm-ticket-delete-meta', array( '_event_id' ), $oiid, $item, $order, $order->id, $modify_meta_extra );
				$zero_meta = apply_filters( 'qsot-zoner-unconfirm-ticket-zero-meta', array(), $oiid, $item, $order, $order->id, $modify_meta_extra );
				if ( ! empty( $delete_meta ) )
					foreach ( $delete_meta as $k )
						wc_delete_order_item_meta( $oiid, $k );
				if ( ! empty( $zero_meta ) )
					foreach ( $zero_meta as $k )
						wc_update_order_item_meta( $oiid, $k, 0 );
			}

			// let other plugins know that this happened
			do_action( 'qsot-unconfirmed-ticket', $order, $item, $oiid );
		}
	}

	// get the order_id from the order_item_id
	protected static function _oid_from_oiid( $oiid ) {
		// create the cache key. caching is important here because it saves us a db query
		$key = 'oiid2oid-' . $oiid;

		// fetch the cache
		$oid = (int) wp_cache_get( $key );

		// if there is no cache, then create it
		if ( $oid <= 0 ) {
			global $wpdb;
			$oid = $wpdb->get_var( $wpdb->prepare( 'select order_id from ' . $wpdb->prefix . 'woocommerce_order_items where order_item_id = %d', $oiid ) );
			wp_cache_set( $key, $oid, 300 );
		}

		// return the found id
		return $oid;
	}

	// when we are adding meta data to the order item, check if the item is a ticket. if it is, then update the order to event zone table with the appropriate data
	public static function update_ticket_order_information( $item_id, $item, $cart_item_key ) {
		// if this items is a ticket
		if ( isset( $item['event_id'] ) ) {
			// fetch the order_id from the order_item_id
			$order_id = self::_oid_from_oiid( $item_id );
			
			// get the unique identifier of this user, which is reported in the table we are updating
			$session_id = WC()->session->get_customer_id();

			// aggregate the information that destinguishes this resveration
			$where = array(
				'event_id' => $item['event_id'],
				'state' => '*',
				'customer_id' => $session_id,
				'ticket_type_id' => $item['product_id'],
				'qty' => $item['quantity'],
			);
			if ( isset( $item['zone_id'] ) )
				$where['zone_id'] = $item['zone_id'];

			// construct the new values for the reservation
			$set = array(
				'order_id' => $order_id,
				'order_item_id' => $item_id,
			);

			// update the data in the table so that the order_id and the order_item_id are correct
			$res = apply_filters( 'qsot-zoner-update-reservation', false, $where, $set );
		}
	}

	// when an item is removed from the cart, if it was a ticket, update the person's reservations as well
	public static function upon_cart_remove_item( $cart_item_key, $cart ) {
		// get the removed item
		$item = $cart->removed_cart_contents[ $cart_item_key ];

		// if the item was linked to an event (meaning it is a ticket)
		if ( isset( $item['event_id'] ) ) {
			// event is required infromation
			$event = apply_filters( 'qsot-get-event', false, $item['event_id'] );
			if ( ! is_object( $event ) ) return;
			$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
			$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );

			$is_zoned = false;
			// if the event has a seating chart that requires a zone, and no zone is present, then fail
			if ( isset( $event->zones ) && is_array( $event->zones ) && count( $event->zones ) ) {
				$is_zoned = true;
			}

			// if the zone is set and it is a zoned event, then remove the seat reservation too
			if ( $is_zoned && isset( $item['zone_id'] ) ) {
				$res = apply_filters( 'qsot-zoner-reserved-current-user', false, array( 'event' => $item['event_id'], 'ticket_type_id' => $item['product_id'], 'zone_id' => $item['zone_id'], 'count' => 0 ) );
				unset( $cart->removed_cart_contents[ $cart_item_key ] );
			// if the event is not zoned, then remove any tickets for this event instead
			} else if ( ! $is_zoned ) {
				$res = apply_filters( 'qsot-zoner-reserved-current-user', false, array( 'event' => $item['event_id'], 'ticket_type_id' => $item['product_id'], 'count' => 0 ) );
				unset( $cart->removed_cart_contents[ $cart_item_key ] );
			}
		}
	}

	// executes before zoner::interest_current_user method, an initiates the cart being saved. this is required, because techinically this step does not add an item to the cart.
	// if this step is not here, then the interest is dropped on the next page load, because if no session is set, then the cart is started anew
	public static function interest_current_user( $success, $event, $ticket_type_id=0, $count=0 ) {
		$customer_id = apply_filters( 'qsot-zoner-current-user', '' );
		// force woocommerce to start a session, so that the unique user identifier can be used to track the 'interest' in this zone before it moves to 'reserved'
		// needed since woocommerce 2.1
		if ( $customer_id ) {
			WC()->session->interested = 1; 
			WC()->session->set_customer_session_cookie( true );
		}    

		return $success;
	}

	// executes AFTER the zoner::reserve_current_user method, and adds the ticket to the cart on a reported success (or removes it on $count = 0)
	public static function reserve_current_user( $success, $event, $ticket_type_id=0, $count=0 ) {
		if ( ! $success ) return $success;

		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'count' => 0,
			'zone_id' => 0,
		);
		$args = array();

		// idetify the current user
		$defs['customer_id'] = apply_filters( 'qsot-zoner-current-user', md5( ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] . ':' : rand( 0, PHP_INT_MAX ) ) . ':' . time() ) );

		// noramlize all arguments
		if ( is_array( $event ) ) {
			$args = wp_parse_args( $event, $defs );
		} else {
			$args = wp_parse_args( array(
				'event' => $event,
				'ticket_type_id' => $ticket_type_id,
				'count' => $count,
				'zone_id' => $zone_id,
			), $defs );
		}

		extract( $args );

		$event = ! is_object( $event ) && (int) $event ? get_post( $event ) : $event;
		if ( ! is_object( $event ) ) return $success;

		if ( ! apply_filters( 'qsot-zoner-is-zone-for-event', false, $zone_id, $event->ID ) ) return $success;
		$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $zone_id );
		
		global $woocommerce;
		
		$data = array(
			'event_id' => $event->ID,
			'zone_id' => $zone->id,
		);

		if ( is_object( $woocommerce->cart ) ) {
			// Generate a ID based on product ID, variation ID, variation data, and other cart item data
			$cart_id = $woocommerce->cart->generate_cart_id( $ticket_type_id, '', '', $data );
			
			// See if this product and its options is already in the cart
			$cart_item_key = $woocommerce->cart->find_product_in_cart( $cart_id );

			if ($count == 0) {
				if ($cart_item_key) {
					$woocommerce->cart->set_quantity( $cart_item_key, 0 );
				}
			} else {
				if ($cart_item_key) {
					$woocommerce->cart->set_quantity( $cart_item_key, $count );
				} else {
					$woocommerce->cart->add_to_cart( $ticket_type_id, $count, '', '', $data );
				}
			}
		}

		return $success;
	}

	// add the zone name to the cart item in the cart display
	public static function add_zone_name_to_cart( $list, $item ) {
		if ( isset( $item['zone_id'] ) ) {
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $item['zone_id'] );
			if ( is_object( $zone ) ) {
				$list[] = array(
					'name' => __( 'Seat', 'qsot-seating' ),
					'display' => apply_filters( 'the_title', ( ! empty( $zone->name ) ) ? $zone->name : $zone->abbr ),
				);
			}
		}

		return $list;
	}

	// if the ticket has a zone designation, then print out the relevant zone information
	public static function ticket_zone_display( $ticket, $multiple ) {
		if ( isset( $ticket->zone, $ticket->zone->name ) ) {
			?><span class="seat label">Seat:</span> <?php echo apply_filters( 'the_title', $ticket->zone->name ) ?><?php
		}
	}

	// if the ticket has a zone designation, load the zone information for use on the ticket display
	public static function compile_ticket_info( $info, $oiid, $order_id ) {
		// fetch the zone_id for this ticket
		$zone_id = isset( $info->order_item, $info->order_item['zone_id'] ) ? (int)$info->order_item['zone_id'] : 0;
	
		if ( $zone_id > 0 ) {
			// load the zone information based on the zone id
			$zone = apply_filters( 'qsot-zoner-get-zone-info', false, $zone_id );

			// if the zone exists, add it to the zone information
			if ( is_object( $zone ) )
				$info->zone = $zone;
		}

		return $info;
	}

	// add the seating information to the seating chart
	public static function get_event_area_by_id( $current, $ea_id ) {
		if ( ! is_object( $current ) || ! isset( $current->post_type ) || self::$o->{'event_area.post_type'} != $current->post_type ) return $current;

		$current->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );
		$current->zoom_zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 2 );

		return $current;
	}

	public static function add_ea_availability_to_event( $event, $event_id ) {
		if ( ! isset( $event->meta, $event->meta->_event_area_obj, $event->meta->_event_area_obj->zones ) ) return $event;

		$zones = $event->meta->_event_area_obj->zones;
		unset( $event->meta->_event_area_obj->zones );
		
	}

	// get a list of all the zones for a seating chart, either regular zones, zoom zones, or both
	public static function get_seating_zones( $zones, $seating_chart_id, $type='*' ) {
		global $wpdb;

		// fetch all the zones
		$q = $wpdb->prepare( 'select * from ' . $wpdb->qsot_seating_zones . ' where seating_chart_id = %d ', $seating_chart_id ) . ( '*' != $type ? $wpdb->prepare( ' and zone_type = %d ', $type ) : '' );
		$res = $wpdb->get_results( $q );

		$by_id = $ids = array();
		// organize the results
		while ( $row = array_shift( $res ) ) {
			$ids[] = $row->id;
			$row->meta = array();
			$by_id[ $row->id . '' ] = $row;
		}

		// fetch all the meta for all zones, and then assign the appropriate meta to each zone
		if ( count( $ids ) ) {
			$all_meta = $wpdb->get_results( 'select * from ' . $wpdb->qsot_seating_zonemeta . ' where qsot_seating_zones_id in( ' . implode( ',', $ids ) .' )' );
			while( $row = array_pop( $all_meta ) ) $by_id[ $row->qsot_seating_zones_id ]->meta[ $row->meta_key ] = maybe_json_decode( $row->meta_value );
		}

		return $by_id;
	}

	public static function update_seating_zones( $success, $zones, $seating_chart_id, $type=1 ) {
		if ( is_object( $zones ) ) $zones = array( $zones );
		if ( ! is_array( $zones ) ) return $success;

		global $wpdb;

		$new_map = array();
		$deletes = $meta_deletes = $meta_updates = $meta_inserts = array();
		$updates = array( 'name' => array(), 'abbr' => array(), 'capacity' => array(), 'ids' => array() );

		while ( ( $key = key( $zones ) ) && ( $zone = current( $zones ) ) ) {
			unset( $zones[ $key ] );
			if ( isset( $zone->id ) ) {
				if ( isset( $zone->_delete ) && $zone->_delete ) {
					$deletes[] = $wpdb->prepare( '( id = %d )', $zone->id );
					$meta_deletes[] = $wpdb->prepare( '( qsot_seating_zones_id = %d )', $zone->id );
				} else {
					$existing_keys = array_unique( $wpdb->get_col( $wpdb->prepare( 'select meta_key from ' . $wpdb->qsot_seating_zonemeta . ' where qsot_seating_zones_id = %d', $zone->id ) ) );
					$existing_keys = empty( $existing_keys ) ? array() : array_combine( $existing_keys, array_fill( 0, count( $existing_keys ), 0 ) );

					$updates['name'][] = $wpdb->prepare( 'when id = ' . $zone->id . ' then %s', $zone->name );
					$updates['abbr'][] = $wpdb->prepare( 'when id = ' . $zone->id . ' then %s', $zone->abbr );
					$updates['capacity'][] = $wpdb->prepare( 'when id = ' . $zone->id . ' then %s', $zone->capacity );
					$updates['ids'][] = $zone->id;

					foreach ( $zone->meta as $k => $v ) {
						if ( strlen( $v ) ) {
							if ( isset( $existing_keys[ $k ] ) ) {
								$existing_keys[ $k ] = 1;
								$meta_updates[] = $wpdb->prepare( 'when qsot_seating_zones_id = %d and meta_key = %s then %s', $zone->id, $k, $v );
							} else {
								$meta_inserts[] = $wpdb->prepare( '(%d, %s, %s)', $zone->id, $k, $v );
							}
						} else {
							$meta_deletes[] = $wpdb->prepare( '( qsot_seating_zones_id = %d and meta_key = %s )', $zone->id, $k );
						}
					}

					foreach ( $existing_keys as $k => $used ) {
						if ( $used ) continue;
						$meta_deletes[] = $wpdb->prepare( '( qsot_seating_zones_id = %d and meta_key = %s )', $zone->id, $k );
					}
				}
			} else {
				$wpdb->insert( $wpdb->qsot_seating_zones, array(
					'abbr' => $zone->abbr,
					'name' => $zone->name,
					'capacity' => $zone->capacity,
					'seating_chart_id' => $seating_chart_id,
					'zone_type' => $type,
				) );
				$insert_id = $wpdb->insert_id;
				$new_map[ $key . '' ] = $insert_id;
				if ( $insert_id && count( $zone->meta ) ) {
					$q = 'insert into ' . $wpdb->qsot_seating_zonemeta . ' ( qsot_seating_zones_id, meta_key, meta_value ) values ';
					$cnt = 0;
					foreach ( $zone->meta as $k => $v )
						$q .= ( $cnt++ > 0 ? ',' : '' ) . $wpdb->prepare( '(' . $insert_id . ', %s, %s)', $k, maybe_json_encode( $v ) );
					$wpdb->query( $q );
				}
			}
		}

		if ( ! empty( $meta_deletes ) ) {
			$wpdb->query( 'delete from ' . $wpdb->qsot_seating_zonemeta . ' where ' . implode( ' or ', $meta_deletes ) );
		}

		if ( ! empty( $deletes ) ) {
			$wpdb->query( 'delete from ' . $wpdb->qsot_seating_zones . ' where ' . implode( ' or ', $deletes ) );
		}

		if ( ! empty( $meta_updates ) ) {
			$wpdb->query( 'update ' . $wpdb->qsot_seating_zonemeta . ' set meta_value = case ' . implode( ' ', $meta_updates ) . ' else meta_value end ' );
		}

		if ( ! empty( $meta_inserts ) ) {
			$wpdb->query( 'insert into ' . $wpdb->qsot_seating_zonemeta . ' ( qsot_seating_zones_id, meta_key, meta_value ) values ' . implode( ',', $meta_inserts ) );
		}

		if ( ! empty( $updates['ids'] ) && ( ! empty( $updates['name'] ) || ! empty( $updates['abbr'] ) || ! empty( $updates['capacity'] ) ) ) {
			$set = array();
			if ( ! empty( $updates['name'] ) ) $set[] = 'name = case ' . implode( ' ', $updates['name'] ) . ' end';
			if ( ! empty( $updates['abbr'] ) ) $set[] = 'abbr = case  ' . implode( ' ', $updates['abbr'] ) . ' end';
			if ( ! empty( $updates['capacity'] ) ) $set[] = 'capacity = case ' . implode( ' ', $updates['capacity'] ) . ' end';
			$wpdb->query( 'update ' . $wpdb->qsot_seating_zones . ' set ' . implode( ', ', $set ) . ' where id in (' . implode( ',', $updates['ids'] ) . ')' );
		}

		return $new_map;
	}

	public static function get_price_structures( $current, $args ) {
		global $wpdb;
		$current = wp_parse_args( $current, array() );

		$args = is_numeric( $args ) ? array( 'event_area_id' => $args ) : $args;
		$args = wp_parse_args( $args, array(
			'id' => '',
			'event_area_id' => '',
			'name' => '',
			'with__prices' => true,
			'indexed' => 'id',
			'single' => false,
			'array' => false,
			'price_list_format' => 'objects',
			'price_sub_group' => '',
		) );
		$args['id'] = is_array( $args['id'] ) ? array_filter( array_map( 'absint', $args['id'] ) ) : absint( $args['id'] );
		$args['event_area_id'] = is_array( $args['event_area_id'] ) ? array_filter( array_map( 'absint', $args['event_area_id'] ) ) : $args['event_area_id'];
		$args['name'] = is_array( $args['array'] ) ? array_filter( array_map( 'trim', $args['name'] ) ) : trim( $args['name'] );
		$args['indexed'] = in_array( ( $args['indexed'] = strtolower( $args['indexed'] ) ), array( 'id', 'name' ) ) ? $args['indexed'] : 'id';

		if ( empty( $args['event_area_id'] ) && empty( $args['id'] ) && empty( $args['name'] ) ) return $current;

		// create the query to look up all relevant price structures
		$q = 'select * from ' . $wpdb->qsot_price_structs . ' where 1=1';

		if ( is_array( $args['id'] ) && ! empty( $args['id'] ) ) $q .= ' and id in (' . implode( ',', $args['id'] ) . ')';
		elseif ( is_scalar( $args['id'] ) && absint( $args['id'] ) > 0 ) $q .= $wpdb->prepare( ' and id = %d', $args['id'] );

		if ( is_array( $args['event_area_id'] ) && ! empty( $args['event_area_id'] ) ) $q .= ' and event_area_id in (' . implode( ',', $args['event_area_id'] ) . ')';
		elseif ( '*' !== $args['event_area_id'] && $args['event_area_id'] > 0 ) $q .= $wpdb->prepare( ' and event_area_id = %d', absint( $args['event_area_id'] ) );

		if ( is_array( $args['name'] ) && ! empty( $args['name'] ) ) $q .= ' and name in (\'' . implode( "','", array_map( 'esc_sql', $args['name'] ) ) . '\')';
		elseif ( strlen( $args['name'] ) > 0 ) $q .= $wpdb->prepare( ' and name = %s', $args['name'] );

		// fetch the list of price structures
		$structs = $wpdb->get_results( apply_filters( 'qsot-get-price-structures-query', $q ) );
		$struct_ids = array_map( 'absint', wp_list_pluck( $structs, 'id' ) );

		$prices = array();
		// all prices
		if ( $args['with__prices'] )
			$prices = apply_filters( 'qsot-get-price-structure-prices', $prices, array( 'price_struct_id' => $struct_ids, 'format' => $args['price_list_format'], 'sub_group' => $args['price_sub_group'] ) );
		
		// organize output
		$final = array();

		if ( is_array( $args['event_area_id'] ) ) {
			while ( $struct = array_shift( $structs ) ) {
				if ( $args['with__prices'] )
					$struct->prices = isset( $prices[$struct->id] ) ? $prices[$struct->id] : array();
				if ( ! isset( $final[ $struct->event_area_id . '' ] ) ) $final[ $struct->event_area_id . '' ] = array();
				$final[ $struct->event_area_id . '' ][$struct->{$args['indexed']}] = apply_filters( 'qsot-get-price-structures-indexed', $struct, $args, $prices );
			}

			return $final;
		} else {
			while ( $struct = array_shift( $structs ) ) {
				if ( $args['with__prices'] )
					$struct->prices = isset( $prices[$struct->id] ) ? $prices[$struct->id] : array();
				$final[$struct->{$args['indexed']}] = apply_filters( 'qsot-get-price-structures-indexed', $struct, $args, $prices );
			}

			return $args['single'] && $args['id'] > 0 ? ( isset( $final[ $args['id'] ] ) ? $final[ $args['id'] ] : null ) : $final;
		}
	}

	public static function get_price_structure_prices( $current, $args ) {
		global $wpdb;
		$current = wp_parse_args( $current, array() );

		$args = wp_parse_args( $args, array(
			'price_struct_id' => '',
			'product_id' => '',
			'sub_group' => '',
			'format' => 'objects', // objects or ids
		) );
		$args['price_struct_id'] = is_array( $args['price_struct_id'] ) ? array_filter( array_map( 'absint', $args['price_struct_id'] ) ) : absint( $args['price_struct_id'] );
		$args['product_id'] = is_array( $args['product_id'] ) ? array_filter( array_map( 'absint', $args['product_id'] ) ) : absint( $args['product_id'] );

		// create the query to look up all relevant price structures
		$q = 'select * from ' . $wpdb->qsot_price_struct_prices . ' where 1=1';

		if ( is_array( $args['price_struct_id'] ) && ! empty( $args['price_struct_id'] ) ) $q .= ' and price_struct_id in (' . implode( ',', $args['price_struct_id'] ) . ')';
		elseif ( is_scalar( $args['price_struct_id'] ) && absint( $args['price_struct_id'] ) > 0 ) $q .= $wpdb->prepare( ' and price_struct_id = %d', $args['price_struct_id'] );

		if ( is_array( $args['product_id'] ) && ! empty( $args['product_id'] ) ) $q .= ' and product_id in (' . implode( ',', $args['product_id'] ) . ')';
		elseif ( $args['product_id'] > 0 ) $q .= $wpdb->prepare( ' and product_id = %d', $args['product_id'] );

		if ( strlen( $args['sub_group'] ) ) $q .= $wpdb->prepare( ' and sub_group = %s', $args['sub_group'] );

		$q .= ' order by display_order asc';

		// get the prices
		$prices = $wpdb->get_results( apply_filters( 'qsot-get-price-structure-prices-query', $q, $args ) );

		$indexed = $products = array();

		// organize the results
		foreach ( $prices as $price ) {
			$product = isset( $products[$price->product_id] ) ? $products[$price->product_id] : ( $products[$price->product_id] = wc_get_product( $price->product_id ) );
			if ( ! is_object( $product ) || is_wp_error( $product ) ) continue;
			$indexed[ $price->sub_group . '' ] = isset( $indexed[ $price->sub_group . '' ] ) ? $indexed[ $price->sub_group . '' ] : array();
			$indexed[ $price->sub_group . '' ][ $price->price_struct_id ] = isset( $indexed[ $price->sub_group . '' ][ $price->price_struct_id ] )
					? $indexed[ $price->sub_group . '' ][ $price->price_struct_id ]
					: array();
			if ( 'ids' == $args['format'] ) {
				$indexed[ $price->sub_group . '' ][ $price->price_struct_id ][] = $price->product_id;
			} else {
				$indexed[ $price->sub_group . '' ][ $price->price_struct_id ][] = apply_filters( 'qsot-get-price-structure-prices-indexed', array(
					'price_struct_id' => $price->price_struct_id,
					'product_id' => $price->product_id,
					'display_order' => $price->display_order,
					'sub_group' => isset( $price->sub_group ) ? $price->sub_group : 0,
					'product_name' => $product->get_title(),
					'product_display_price' => wc_price( $product->get_price() ),
					'product_raw_price' => strip_tags( wc_price( $product->get_price() ) ),
					//'product_raw_price' => html_entity_decode( strip_tags( wc_price( $product->get_price() ) ) ),
					'product_price' => $product->price,
				), $price, $args );
			}
		}

		if ( strlen( $args['sub_group'] ) ) {
			return isset( $indexed[ $args['sub_group'] ] ) ? $indexed[ $args['sub_group'] ] : array();
		}

		$reindexed = array();
		foreach ( $indexed as $sub_group => $by_struct_id ) {
			foreach ( $by_struct_id as $struct_id => $prices ) {
				$reindexed[ $struct_id ] = isset( $reindexed[ $struct_id ] ) ? $reindexed[ $struct_id ] : array();
				$reindexed[ $struct_id ][ $sub_group ] = $prices;
			}
		}

		return $reindexed;
	}

	public static function update_price_structure( $pricing, $seating_chart_id ) {
		global $wpdb;

		$current = apply_filters( 'qsot-get-price-structures', array(), array( 'event_area_id' => $seating_chart_id, 'price_list_format' => 'ids', 'price_sub_group' => '' ) );
		$deleted = array_diff( array_keys( $current ), array_keys( $pricing ) );

		if ( count( $deleted ) ) {
			$q = 'delete from ' . $wpdb->qsot_price_struct_prices . ' where price_struct_id in(' . implode( ',', $deleted ) . ') ';
			$wpdb->query( $q );

			$q = 'delete from ' . $wpdb->qsot_price_structs . ' where id in(' . implode( ',', $deleted ) . ')';
			$wpdb->query( $q );
		}

		foreach ( $pricing as $struct_id => $struct ) {
			if ( $struct_id < 0 ) {
				$wpdb->insert( $wpdb->qsot_price_structs, array( 'event_area_id' => $seating_chart_id, 'name' => $struct['name'] ) );
				$struct_id = $wpdb->insert_id;
			} else {
				$wpdb->update( $wpdb->qsot_price_structs, array( 'event_area_id' => $seating_chart_id, 'name' => $struct['name'] ), array( 'id' => $struct['id'] ) );
			}

			if ( $struct_id <= 0 ) continue;

			$q = $wpdb->prepare( 'delete from ' . $wpdb->qsot_price_struct_prices . ' where price_struct_id = %d', $struct_id );
			$wpdb->query( $q );

			$q = 'insert into '. $wpdb->qsot_price_struct_prices . ' ( price_struct_id, product_id, display_order, sub_group ) values ';
			$qs = array();
			foreach ( $struct['prices'] as $sub_group => $prices ) {
				$order = 0;
				foreach ( $prices as $price_id ) {
					$qs[] = $wpdb->prepare( '(%d, %d, %d, %s)', $struct_id, $price_id, $order++, $sub_group );
				}
			}

			if ( count( $qs ) ) {
				$q .= implode( ',', $qs );
				$wpdb->query( $q );
			}
		}
	}

	protected static function _setup_admin_options() {
		self::$options->def( 'qsot-seating-one-click-single-price', 'yes' );

		self::$options->add(array(
			'order' => 400,
			'type' => 'title',
			'title' => __( 'Seating', 'qsot-seating' ),
			'id' => 'heading-frontend-seating-1',
			'page' => 'frontend',
		));

		self::$options->add(array(
			'order' => 410,
			'id' => 'qsot-seating-one-click-single-price',
			'type' => 'checkbox',
			'title' => __( 'One-click reservations', 'qsot-seating' ),
			'desc' => __( 'When there is a single price level available for a seat, and the maximum capacity for the seat is "1", then allow the user to click one time to reserve the seat, instead of once to choose the seat and once to select a price level.', 'qsot-seating' ),
			'default' => 'yes',
			'page' => 'frontend',
		));

		self::$options->add(array(
			'order' => 499,
			'type' => 'sectionend',
			'id' => 'heading-frontend-seating-1',
			'page' => 'frontend',
		));
	}

	public static function on_activation() {
		global $wpdb;

		$per = 100;
		$offset = 0;
		$vq = 'select id from ' . $wpdb->posts . ' where post_type = %s and post_status = %s limit %d offset %d';

		// publish all event areas that are children of published venues
		while ( $venue_ids = $wpdb->get_col( $wpdb->prepare( $vq, self::$o->{'venue.post_type'}, 'publish', $per, $offset ) ) ) { $offset += $per;
			$q = $wpdb->prepare(
				'update ' . $wpdb->posts . ' set post_status = %s where post_type = %s and post_status = %s and post_parent in (' . implode( ',', array_map( 'absint', $venue_ids ) ) . ')',
				'publish',
				self::$o->{'event_area.post_type'},
				'inherit'
			);
			$wpdb->query( $q );
		}

		$offset = 0;
		$vq = 'select id from ' . $wpdb->posts . ' where post_type = %s and post_status != %s limit %d offset %d';

		// put all event areas into pending that are children of non-published venues
		while ( $venue_ids = $wpdb->get_col( $wpdb->prepare( $vq, self::$o->{'venue.post_type'}, 'publish', $per, $offset ) ) ) { $offset += $per;
			$q = $wpdb->prepare(
				'update ' . $wpdb->posts . ' set post_status = %s where post_type = %s and post_status = %s and post_parent in (' . implode( ',', array_map( 'absint', $venue_ids ) ) . ')',
				'pending',
				self::$o->{'event_area.post_type'},
				'inherit'
			);
			$wpdb->query( $q );
		}

		// trigger the table updater
		if ( has_action( 'qsot-db-upgrader-trigger' ) ) {
			do_action( 'qsot-db-upgrader-trigger' );
		} else if ( class_exists( 'qsot_db_upgrader' ) ) {
			qsot_db_upgrader::admin_init();
		}

		global $wpdb;

		$per = 500;
		$offset = 0;
		$q = 'select id from ' . $wpdb->posts . ' where post_type = %s order by id limit %d offset %d';

		$lookup = array();

		// on activate, cycle through all event areas
		while ( $event_area_ids = $wpdb->get_col( $wpdb->prepare( $q, self::$o->{'event_area.post_type'}, $per, $offset ) ) ) { $offset += $per;
			self::_memory_check();
			$structs_by_ea = apply_filters( 'qsot-get-price-structures', array(), array( 'event_area_id' => $event_area_ids ) );

			// for each event area, check if the 'multi price structure' has been set
			foreach ( $event_area_ids as $ea_id ) {
				if ( isset( $structs_by_ea[$ea_id] ) ) {
					if ( ! isset( $lookup[$ea_id] ) )
						$lookup[$ea_id] = current( $structs_by_ea[$ea_id] )->id;
					continue;
				}
				$lookup[$ea_id] = 0;

				// fetch the singular legacy pricing event price
				$ticket_type_id = (int)get_post_meta( $ea_id, '_pricing_options', true );

				// if there is no multi price structure for the event, then create a generic one
				$wpdb->insert(
					$wpdb->qsot_price_structs,
					array( 'event_area_id' => $ea_id, 'name' => __( 'Generic Pricing', 'qsot' ) )
				);
				$ps_id = $wpdb->insert_id;

				// if there is not a legacy price
				if ( $ticket_type_id <= 0 ) continue; // create the structure, but do not add prices to it, if there are no legacy prices to add

				// if the price structure was create successfully, then add the one generic legacy price to it
				if ( $ps_id > 0 ) {
					$wpdb->insert(
						$wpdb->qsot_price_struct_prices,
						array( 'price_struct_id' => $ps_id, 'display_order' => 0, 'product_id' => $ticket_type_id )
					);
					// record the default 'generic pricing' pricing struct for this event area, for later user on even correction
					$lookup[$ea_id] = $ps_id;
				}
			}
		}

		$q = 'select id from ' . $wpdb->posts . ' where post_type = %s order by id limit %d offset %d';
		$offset = 0;

		// now that all the event areas have multi pricing setup, cycle through the events, and update any that are not using the multi price
		while ( $event_ids = $wpdb->get_col( $wpdb->prepare( $q, self::$o->core_post_type, $per, $offset ) ) ) { $offset += $per;
			foreach ( $event_ids as $event_id ) {
				// if the event is already using a multi price structure, then skip this update
				$ps_id = get_post_meta( $event_id, '_pricing_struct_id', true);
				if ( $ps_id > 0 ) continue;

				// lookup the proper price_struct_id based on the event area
				$ea_id = get_post_meta( $event_id, '_event_area_id', true );
				$ps_id = isset( $lookup[$ea_id] ) ? $lookup[$ea_id] : '';

				// update the event, pricing struct to the proper generic one, if we found it
				update_post_meta( $event_id, '_pricing_struct_id', $ps_id );
			}
		}
	}

	// used to check the memory usage and blow out any relevant caches, during the intallation process
	protected static function _memory_check($flush_percent_range=80) {
		global $wpdb;
		static $max = false;
		$dec = $flush_percent_range / 100;

		// fetch the known max memory lmit, if it was not already fetched
		if ($max === false) $max = QSOT::memory_limit(true);

		$usage = memory_get_usage();
		// determine if the current usage is too high. if it is, then blow out some caches
		if ($usage > $max * $dec) {
			wp_cache_flush();
			$wpdb->queries = array();
		}
	}

	// 1.2.1 has an upgrade to table indexes, which core wp DB upgrader does not handle very well. this function does a pre-update that prevents the problem
	public static function version_1_0_1_upgrade() {
		global $wpdb;

		// list of indexes to drop
		$indexes_by_table = array(
			$wpdb->qsot_seating_zones => array( 'sc_id' ),
			$wpdb->qsot_seating_zonemeta => array( 'et_id', 'mk' ),
			$wpdb->qsot_price_structs => array( 'psid', 'ea' ),
			$wpdb->qsot_price_struct_prices => array( 'ps2p', 'pid', 'sb_id' ),
		);
		$tables = $wpdb->get_col( 'show tables' );
		$tables = array_combine( $tables, array_fill( 0, count( $tables ), 1 ) );

		// for each table with indexes to drop
		foreach ( $indexes_by_table as $table => $indexes ) {
			// if the table exists
			if ( isset( $tables[ $table ] ) ) {
				// foreach index on that table
				foreach ( $indexes as $index ) {
					// if the index exists
					$exists = $wpdb->get_row( $wpdb->prepare( 'show index from ' . $table . ' where Key_name = %s', $index ) );
					if ( $exists ) {
						// drop it
						$q = 'alter ignore table ' . $table . ' drop index `' . $index . '`';
						$r = $wpdb->query( $q );
					}
				}
			}
		}
	}

	public static function setup_tables( $tables ) {
    global $wpdb;
		
		// skip this if the func is called before the needed vars are set yet (like in a late OTCE activation)
		if ( ! isset( $wpdb->qsot_event_zone_to_order ) )
			return $tables;

		// if the opentickets plugin is at a version before we improved the db updater, then run the upgrae manually
		if ( class_exists( 'QSOT' ) && version_compare( QSOT::version(), '1.10.6' ) <= 0 ) {
			// maybe remove index if structs table is out of date, since the unique key gets updated. unfortunately this is not handled gracefully in wp.... yet
			$versions = get_option( '_qsot_upgrader_db_table_versions', array() );
			if ( ! isset( $versions[ $wpdb->qsot_price_struct_prices ] ) || version_compare( $versions[ $wpdb->qsot_price_struct_prices ], '0.1.6' ) < 0 )
				self::version_1_0_1_upgrade();
		}

    $tables[$wpdb->qsot_event_zone_to_order] = array(
      'version' => '1.1.7',
      'fields' => array(
				'event_id' => array( 'type' => 'bigint(20) unsigned' ), // post of type qsot-event
				'order_id' => array( 'type' => 'bigint(20) unsigned' ), // post of type shop_order (woocommerce)
				'zone_id' => array( 'type' => 'bigint(20) unsigned', 'default' => '0' ), // the id of the zone this reservation is for
				'quantity' => array( 'type' => 'smallint(5) unsigned' ), // some zones can have more than 1 capacity, so we need a quantity to designate how many were purchased ina given zone
				'state' => array( 'type' => 'varchar(20)' ), // word descriptor for the current state. core states are interest, reserve, confirm, occupied
				'since' => array( 'type' => 'timestamp', 'default' => 'CONST:|CURRENT_TIMESTAMP|' ), // when the last action took place. used for lockout clearing
				'session_customer_id' => array( 'type' => 'varchar(150)' ), // woo session id for linking a ticket to a user, before the order is actually created (like interest and reserve statuses)
				'ticket_type_id' => array( 'type' => 'bigint(20) unsigned', 'default' => '0' ), // product_id of the woo product that represents the ticket that was purchased/reserved
				'order_item_id' => array( 'type' => 'bigint(20) unsigned', 'default' => '0' ), // order_item_id of the order item that represents this ticket. present after order creation
      ),
      'keys' => array(
        'KEY evt_id (event_id)',
        'KEY ord_id (order_id)',
				'KEY z_id (zone_id)',
        'KEY oiid (order_item_id)',
				'KEY stt (state)',
      )
    );

    $tables[ $wpdb->qsot_seating_zones ] = array(
      'version' => '0.2.0',
      'fields' => array(
        'id' => array('type' => 'bigint(20) unsigned', 'extra' => 'auto_increment'),
        'seating_chart_id' => array('type' => 'bigint(20) unsigned', 'default' => '0'), // post of type qsot-seating
        'name' => array('type' => 'varchar(100)'),
        'zone_type' => array('type' => 'tinyint(3)', 'default' => '1'), // 1 = zone; 2 = zoom-zone
        'abbr' => array('type' => 'varchar(100)'),
				'capacity' => array('type' => 'int(10) unsigned', 'default' => '0')
      ),
      'keys' => array(
        'PRIMARY KEY  (id)',
        'KEY sc_id (seating_chart_id)',
      ),
			'pre-update' => array(
				'when' => array(
					'version <' => array(
						'1.0.1' => array( __CLASS__, 'version_1_0_1_upgrade' ),
					),
				),
			),
    );

    $tables[$wpdb->qsot_seating_zonemeta] = array(
      'version' => '0.2.0',
      'fields' => array(
        'meta_id' => array('type' => 'bigint(20) unsigned', 'extra' => 'auto_increment'),
        'qsot_seating_zones_id' => array('type' => 'bigint(20) unsigned', 'default' => '0'),
        'meta_key' => array('type' => 'varchar(255)'),
        'meta_value' => array('type' => 'text'),
      ),
      'keys' => array(
        'PRIMARY KEY  (meta_id)',
        'KEY et_id (qsot_seating_zones_id)',
        'KEY mk (meta_key)',
      ),
			'pre-update' => array(
				'when' => array(
					'version <' => array(
						'1.0.1' => array( __CLASS__, 'version_1_0_1_upgrade' ),
					),
				),
			),
    );

    $tables[$wpdb->qsot_price_structs] = array(
      'version' => '0.1.4',
      'fields' => array(
				'id' => array( 'type' => 'bigint(20) unsigned', 'extra' => 'auto_increment' ), // id of this price structure
				'event_area_id' => array( 'type' => 'bigint(20) unsigned' ), // id of the event area the pricing structure links to
				'name' => array( 'type' => 'varchar(200)' ), // name of this pricing strucutre to be displayed in the admin
      ),   
      'keys' => array(
        'PRIMARY KEY  psid (id)',
				'INDEX ea (event_area_id)',
      ),
			'pre-update' => array(
				'when' => array(
					'version <' => array(
						'1.0.1' => array( __CLASS__, 'version_1_0_1_upgrade' ),
					),
				),
			),
    );

    $tables[$wpdb->qsot_price_struct_prices] = array(
      'version' => '0.1.6',
      'fields' => array(
				'price_struct_id' => array( 'type' => 'bigint(20) unsigned' ), // id of the price structure that this price is part of
				'product_id' => array( 'type' => 'bigint(20) unsigned' ), // id of the the product for this price
				'display_order' => array( 'type' => 'tinyint(3) unsigned' ), // order in which to display this price
				'sub_group' => array( 'type' => 'bigint(20) unsigned', 'default' => '0' ), // sub grouping of prices. used to specify specific seat pricing
      ),
      'keys' => array(
				'UNIQUE KEY ps2p (price_struct_id, product_id, sub_group)',
				'INDEX pid (product_id)',
				'KEY sb_id (sub_group)',
      ),
			'pre-update' => array(
				'when' => array(
					'version <' => array(
						'1.0.1' => array( __CLASS__, 'version_1_0_1_upgrade' ),
					),
				),
			),
    );   

    return $tables;
	}
}

if ( ! function_exists( 'maybe_json_decode' ) ) {
	function maybe_json_decode( $str ) {
		$out = @json_decode( $str );
		return ( false === $out ) ? $str : $out;
	}
}

if ( ! function_exists( 'maybe_json_encode' ) ) {
	function maybe_json_encode( $val ) {
		$out = @json_encode( $val );
		return ( false === $out ) ? '' : $out;
	}
}

if ( defined( 'ABSPATH' ) & function_exists( 'add_action' ) ) QSOT_seating_core::pre_init();
