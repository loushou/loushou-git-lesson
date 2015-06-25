<?php (__FILE__ == $_SERVER['SCRIPT_FILENAME']) ? die(header('Location: /')) : null;

class QSOT_zoner {
	protected static $o = null;
	protected static $e2ea = array();

	public static function pre_init() {
		$settings_class_name = apply_filters('qsot-settings-class-name', '');
		if (empty($settings_class_name) || !class_exists($settings_class_name)) return;
		self::$o = call_user_func_array(array($settings_class_name, 'instance'), array());

		self::$o->z = apply_filters( 'qsot-zoner-settings', array(
			'states' => array(
				'o' => 'occupied', // confirmed seat that has been actually occupied, via checkin feature. lasts indefinitely
				'c' => 'confirmed', // user confirmed seat, and paid for it (if applicable). lasts indefinitely
				'r' => 'reserved', // user has selected a price for a seat, but has not yet completed the purchase. lasts 1 hour
				'i' => 'interest', // user has selected a seat, but not a price yet
			),
			'state_timeouts' => array( // in seconds
				'o' => 0, // never
				'c' => 0, // never
				'r' => 3600, // 1 hour
				'i' => 900, // 15 minutes
			),
		) );

		// setup the db tables for the zone reserver
		self::setup_table_names();
		add_action( 'switch_blog', array( __CLASS__, 'setup_table_names' ), PHP_INT_MAX, 2 );

		// state timeouts
		add_filter( 'qsot-temporary-zone-states', array( __CLASS__, 'temporary_zone_states' ), 10, 1 );
		add_filter( 'qsot-permanent-zone-states', array( __CLASS__, 'permanent_zone_states' ), 10, 1 );

		// reservation functions
		add_filter( 'qsot-zoner-item-data-keys', array( __CLASS__, 'item_data_keys_to_maintain' ), 10, 2 );
		add_action( 'qsot-zoner-clear-locks', array( __CLASS__, 'clear_locks' ), 10, 2 );
		add_filter( 'qsot-zoner-confirmed', array( __CLASS__, 'confirm' ), 10, 7 );
		add_filter( 'qsot-zoner-reserved-current-user', array( __CLASS__, 'reserve_current_user' ), 10, 5 );
		add_filter( 'qsot-zoner-reserved', array( __CLASS__, 'reserve' ), 10, 7 );
		add_filter( 'qsot-zoner-interest-current-user', array( __CLASS__, 'interest_current_user' ), 10, 5 );
		add_filter( 'qsot-zoner-interest', array( __CLASS__, 'interest' ), 10, 7 );
		add_filter( 'qsot-zoner-owns-current-user', array( __CLASS__, 'owns_current_user' ), 10, 5 );
		add_filter( 'qsot-zoner-owns', array( __CLASS__, 'owns' ), 10, 8 );
		add_filter( 'qsot-zoner-ownerships-current-user', array( __CLASS__, 'ownerships_current_user' ), 10, 5 );
		add_filter( 'qsot-zoner-ownerships', array( __CLASS__, 'ownerships' ), 10, 8 );
		add_filter( 'qsot-zoner-update-reservation', array( __CLASS__, 'update_reservation' ), 10, 4 );
		add_filter( 'qsot-zoner-current-user', array( __CLASS__, 'current_user' ), 10, 4 );
		add_filter( 'qsot-zoner-event-zone-reservations', array( __CLASS__, 'all_event_zone_reservations' ), 10, 2 );

		// zone-to-event/event-area functions
		add_filter( 'qsot-zoner-is-zone-for-event', array( __CLASS__, 'is_zone_for_event' ), 10, 4 );
		add_filter( 'qsot-zoner-is-zone-for-event-area', array( __CLASS__, 'is_zone_for_event_area' ), 10, 4 );
		add_filter( 'qsot-zoner-get-event-zone-available', array( __CLASS__, 'get_event_zone_available' ), 10, 4 );
		add_filter( 'qsot-zoner-get-zone-info', array( __CLASS__, 'get_zone_info' ), 10, 2 );

		// determine if the item could be a ticket
		add_filter( 'qsot-item-is-ticket', array( __CLASS__, 'item_is_ticket' ), 100, 2 );

		// checkin code
		add_filter( 'qsot-is-already-occupied', array( __CLASS__, 'is_occupied' ), 1000, 4 );
		add_filter( 'qsot-occupy-sold', array( __CLASS__, 'occupy_sold' ), 1000, 5 );

		// stats
		add_filter( 'qsot-count-tickets', array( __CLASS__, 'count_tickets' ), 1000, 2 );
	}

	// determine if a particular zone exists inside the seating chart for a given event
	public static function is_zone_for_event( $res, $zone_id, $event_id, $extra='' ) {
		// cache any event area lookups
		if ( ! isset( self::$e2ea[ $event_id . '' ] ) ) self::$e2ea[ $event_id . '' ] = (int)get_post_meta( $event_id, self::$o->{'meta_key.event_area'}, true );
		// leverage the zone to event area lookup below
		return self::$e2ea[ $event_id . '' ] ? apply_filters( 'qsot-zoner-is-zone-for-event-area', $res, $zone_id, self::$e2ea[ $event_id . '' ], $extra ) : $res;
	}

	// determine if a particular zone exists inside the specified seating chart
	public static function is_zone_for_event_area( $res, $zone_id, $event_area_id, $extra='' ) {
		$found = null;
		// fetch a cached list of zones for this seating chart
		$cache = wp_cache_get( 'ea-zones-' . $event_area_id, 'qsots' );

		// if no cache exists yet, make one and store it for later reuse
		if ( ! is_array( $cache ) ) {
			global $wpdb;

			// fetch a list of zones for this seating chart
			$res = $wpdb->get_results( $wpdb->prepare( 'select id, capacity from ' . $wpdb->qsot_seating_zones . ' where seating_chart_id = %d', $event_area_id ) );
			// organize the list
			$cache = array();
			if ( is_array( $res ) )
				foreach ( $res as $row )
					$cache[ $row->id . '' ] = (int)$row->capacity;

			$cache['0'] = (int)get_post_meta( $event_area_id, self::$o->{'meta_key.capacity'}, true );

			// store the list
			wp_cache_set( 'ea-zones-' . $event_area_id, $cache, 'qsots', 300 );
		}

		// use the cache to determine zone existence
		return isset( $cache[ $zone_id . '' ] );
	}

	public static function get_event_zone_available( $res, $zone_id, $event_id, $extra='' ) {
		// local cache so that it does not persist through sessions, if the memcache object-cache.php file is present
		static $avail = array();

		$extra = wp_parse_args( $extra, array(
			'current_user' => apply_filters( 'qsot-zoner-current-user', md5( ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] . ':' : rand( 0, PHP_INT_MAX ) ) . ':' . time() ) ),
			'order_id' => 0,
			'force' => false,
		) );

		$key = $zone_id . ':' . $event_id;
		$current_user = $extra['current_user'];
		$order_id = $extra['order_id'];

		// create a cache if none exists
		if ( $extra['force'] || ! isset( $avail[ $key ] ) ) {
			// cache any event area lookups
			if ( ! isset( self::$e2ea[ $event_id . '' ] ) ) self::$e2ea[ $event_id . '' ] = (int)get_post_meta( $event_id, self::$o->{'meta_key.event_area'}, true );
			$ea_id = self::$e2ea[ $event_id . '' ];

			// get the capacity data for this event area
			$cap_cache = wp_cache_get( 'ea-zones-' . $ea_id, 'qsots' );
			if ( $extra['force'] || ! is_array( $cap_cache ) ) {
				apply_filters( 'qsot-zoner-is-zone-for-event-area', false, $zone_id, $ea_id );
				$cap_cache = wp_cache_get( 'ea-zones-' . $ea_id, 'qsots' );
				$cap_cache = is_array( $cap_cache ) ? $cap_cache : array();
			}

			// fetch the current reservation count and store it for later reuse with the calced capacity
			global $wpdb;
			$q = $wpdb->prepare(
				'select sum(quantity) from ' . $wpdb->qsot_event_zone_to_order . ' as zto where event_id = %d and zone_id = %d and not ( state = %s ',
				$event_id,
				$zone_id,
				self::$o->{'z.states.i'}
			);
			if ( ! empty( $current_user ) ) {
				$q .= $wpdb->prepare( 'and session_customer_id = %s and order_id = %d', $current_user, $order_id );
			} else if ( $order_id > 0 ) {
				$q .= $wpdb->prepare( 'and order_id = %d', $order_id );
			}
			$q .= ')';
			$reserved = $wpdb->get_var( $q );
			$capacity = isset( $cap_cache[ $zone_id . '' ] ) ? (int)$cap_cache[ $zone_id . '' ] : 0;
			// store in local cache
			$avail[ $key ] = array( $reserved, $capacity );
		}

		// return the difference in reservations to capacity
		return max( 0, $avail[ $key ][1] - $avail[ $key ][0] );
	}

	// get the information about a specific zone from the db
	public static function get_zone_info( $data, $zone_id ) {
		$zone_id = (int)$zone_id;
		// first see if the data is cached
		$cache = wp_cache_get( 'zone-info-' . $zone_id, 'qsots' );

		// if it is not cached, build the cache
		if ( ! is_object( $cache ) ) {
			global $wpdb;
			if ( $zone_id > 0 ) {
				// fetch teh basic zone information
				$cache = $wpdb->get_row( $wpdb->prepare( 'select * from ' . $wpdb->qsot_seating_zones . ' where id = %d', $zone_id ) );
			} else {
				$cache = (object)array(
					'id' => 0,
					'seating_chart_id' => 0,
					'name' => 'General Admission',
					'zone_type' => 1,
					'abbr' => 'GA',
					'capacity' => 0,
				);
			}
			// if there is such a zone
			if ( is_object( $cache ) ) {
				// load the meta data for the zone and attach it to the object
				$cache->meta = array();
				if ( $cache->id > 0 ) {
					$meta = $wpdb->get_results( $wpdb->prepare( 'select * from ' . $wpdb->qsot_seating_zonemeta . ' where qsot_seating_zones_id = %d order by meta_id asc', $zone_id ) );
					foreach ( $meta as $k => $v ) $cache->meta[ $k ] = self::_maybe_json_decode( $v );
				} else {
					$cache->meta = array();
				}
				// store the resulting object in cache
				wp_cache_set( 'zone-info-' . $zone_id, $cache, 'qsots', 0 );
			}
			// if there was no zone fetched, then dont store any cache
		}

		// return the resulting object
		return $cache;
	}

	public static function _maybe_json_encode($data) {
		return @json_encode($data);
	}

	public static function _maybe_json_decode($str) {
		$d = @json_decode($str);
		return $d !== null || $str === 'null' ? $d : $str;
	}

	public static function count_tickets( $current, $args='' ) {
		$args = wp_parse_args( $args, array(
			'state' => '*',
			'event_id' => '',
		) );

		global $wpdb;

		$q = 'select state, sum(quantity) tot from ' . $wpdb->qsot_event_zone_to_order . ' where 1=1';
		if ( !empty( $args['event_id'] ) ) {
			if ( is_array( $args['event_id'] ) ) {
				$ids = array_filter( array_map( 'absint', $args['event_id'] ) );
				if ( ! empty( $ids ) )
					$q .= ' and event_id in (' . implode(',', $ids) . ')';
			} else if ( (int)$args['event_id'] > 0 ) {
				$q .= $wpdb->prepare( ' and event_id = %d', $args['event_id'] );
			}
		}
		$q .= ' group by state';

		$rows = $wpdb->get_results( $q );
		$out = array();

		if ( empty( $rows ) ) return ( ! empty( $args['state'] ) && $args['state'] != '*' ) ? 0 : $out;

		foreach ( $rows as $row ) $out[ $row->state ] = $row->tot;

		if ( ! empty( $args['state'] ) && $args['state'] != '*' ) return isset( $out[ $args['state'] ] ) ? $out[ $args['state'] ] : 0;

		return $out;
	}

	// list of 'states' (db table field) that are considered temporary, and expire
	public static function temporary_zone_states( $list ) {
		static $ours = false;
		if ( $ours === false ) {
			$ours = array();
			foreach ( self::$o->{'z.state_timeouts'} as $k => $time )
				if ( $time > 0 )
					$ours[] = self::$o->{ 'z.states.' . $k };
		}
		return is_array( $list ) ? array_unique( array_merge( $list, $ours ) ) : $ours;
	}

	// list of 'states' (db table field) that are considered permanent, and never expire
	public static function permanent_zone_states( $list ) {
		static $ours = false;
		if ( $ours === false ) {
			$ours = array();
			foreach ( self::$o->{'z.state_timeouts'} as $k => $time )
				if ( $time <= 0 )
					$ours[] = self::$o->{ 'z.states.' . $k };
		}
		return is_array( $list ) ? array_unique( array_merge( $list, $ours ) ) : $ours;
	}

	// determine if all of a given ticket have been marked as occupied or not
	public static function is_occupied( $current, $order_id, $event_id, $oiid ) {
		$order = new WC_Order( $order_id );
		$event = apply_filters( 'qsot-get-event', false, $event_id );
		if ( ! is_object( $order ) || ! is_object( $event ) || ! isset( $order->id ) ) return false;

		$order_items = $order->get_items();
		$oi = isset( $order_items[ $oiid ] ) ? $order_items[ $oiid ] : false;
		if ( ! is_array( $oi ) || ! isset( $oi['event_id'] ) ) return false;

		// if there are confirms still, then the user can still checkin, because they are not all occupied yet
		$confirms = apply_filters( 'qsot-zoner-owns', array(), $event, $oi['product_id'], self::$o->{'z.states.c'}, false, $order_id, $oiid );
		
		return ! $confirms;
	}

	// if there are 'confirmed' seats that are not checked in yet (occupied) that match the given criteria, then check them in
	public static function occupy_sold( $current, $order_id, $event_id, $oiid, $qty ) {
		$order = new WC_Order( $order_id );
		$event = apply_filters( 'qsot-get-event', false, $event_id );
		if ( ! is_object( $order ) || ! is_object( $event ) || ! isset( $order->id ) ) return false;

		$order_items = $order->get_items();
		$oi = isset( $order_items[ $oiid ] ) ? $order_items[ $oiid ] : false;
		if ( ! is_array( $oi ) || ! isset( $oi['event_id'] ) ) return false;

		// get a list of all states that have entries for this ticket purchase
		$all = apply_filters( 'qsot-zoner-owns', array(), $event, $oi['product_id'], '*', false, $order_id, $oiid );

		// if there are none in the 'confirm' category, then either we have a non-ticket (unlikely) or they are all checked in already. either way, fail.
		if ( ! isset( $all[ self::$o->{'z.states.c'} ] ) || (int)$all[ self::$o->{'z.states.c'} ] < $qty ) return false;
		$confirms = apply_filters( 'qsot-zoner-ownerships', array(), $event, $oi['product_id'], self::$o->{'z.states.c'}, false, $order_id, $oiid );
		if ( empty( $confirms ) ) return false;

		// if there a none already checked in, then insert a row to be updated
		if ( ! isset( $all[ self::$o->{'z.states.o'} ] ) ) {
			global $wpdb;
			$wpdb->insert(
				$wpdb->qsot_event_zone_to_order,
				array(
					'event_id' => $event_id,
					'ticket_type_id' => $oi['product_id'],
					'quantity' => 0,
					'state' => self::$o->{'z.states.o'},
					'session_customer_id' => $confirms[0]->session_customer_id,
					'order_id' => $order_id,
					'order_item_id' => $oiid,
				)
			);
			$all[ self::$o->{'z.states.o'} ] = 0;
		}

		$res_dec = apply_filters(
			'qsot-zoner-update-reservation',
			false,
			array( 'event_id' => $event_id, 'qty' => (int)$all[ self::$o->{'z.states.c'} ], 'state' => self::$o->{'z.states.c'}, 'order_id' => $order_id, 'order_item_id' => $oiid ),
			array( 'qty' => '::DEC::' )
		);

		$res_inc = apply_filters(
			'qsot-zoner-update-reservation',
			false,
			array( 'event_id' => $event_id, 'qty' => (int)$all[ self::$o->{'z.states.o'} ], 'state' => self::$o->{'z.states.o'}, 'order_id' => $order_id, 'order_item_id' => $oiid ),
			array( 'qty' => '::INC::' )
		);

		return $res_inc && $res_dec;
	}

	// is the specified order item a ticket
	public static function item_is_ticket( $is, $item ) {
		if ( ! isset( $item['event_id'] ) || empty( $item['event_id'] ) ) return false;
		return $is;
	}

	// clear out any temporary locks that have expired
	public static function clear_locks( $event_id=0, $customer_id=false ) {
		global $wpdb;
		// require either required basic information type
		if ( empty( $event_id ) && empty( $customer_id ) ) return;

		// get a list of expireable states, and format it for quick, reliable use later
		$temp_states = array_flip( apply_filters( 'qsot-temporary-zone-states', array() ) );

		// cycle through each state type
		foreach ( self::$o->{'z.states'} as $k => $name ) {
			// if it is not a temporary state, pass
			if ( ! isset( $temp_states[ $name ] ) ) continue;

			// get the timeout of the state
			$timeout = (int)self::$o->{ 'z.state_timeouts.' . $k };

			// if there is a defined, positive timeout, then we need to remove any temporary locks for this state, that have surpassed that timeout
			if ( $timeout > 0 ) {
				// build a query that will find all locks that have expired, based on the supplied criteria. we fetch the list so that we can
				// notify other sources that these locks are going away (such as other plugins, or upgrades to this plugin)
				$q = $wpdb->prepare( 'select * from ' . $wpdb->qsot_event_zone_to_order . ' where state = %s and since < NOW() - INTERVAL %d SECOND', self::$o->{ 'z.states.' . $k }, $timeout );
				// if the event was supplied, reduce the list to only ones for this event
				if ( ! empty( $event_id ) ) $q .= $wpdb->prepare( ' and event_id = %d', $event_id );
				// if the customer id was supplied then, add that to the sql
				if ( ! empty( $customer_id ) ) {
					if ( is_array( $customer_id ) ) $q .= ' and session_customer_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $customer_id ) ) . '\')';
					else $q .= $wpdb->prepare( ' and session_customer_id = %s', $customer_id );
				}
				// fetch a list of existing locks.
				$locks = $wpdb->get_results( $q );

				// tell everyone that the locks are going away
				do_action( 'qsot-removing-zone-locks', $locks, self::$o->{ 'z.states.' . $k }, $event_id, $customer_id );

				// delete the locks we said we would delete in the above action.
				// this is done in this manner, because we need to only delete the ones we told others about.
				// technically, if the above action call takes too long, other locks could have expired by the time we get to delete them.
				// thus we need to explicitly delete ONLY the ones we told everyone we were deleting, so that none are removed without the others being notified.
				$q = 'delete from ' . $wpdb->qsot_event_zone_to_order . ' where '; // base query
				$wheres = array(); // holder for queries defining each specific row to delete
				// cycle through all the locks we said we would delete
				foreach ( $locks as $lock ) {
					// aggregate a partial where statement, that specifically identifies this row, using all fields for positive id
					$fields = array();
					foreach ( $lock as $k => $v ) $fields[] = $wpdb->prepare( $k . ' = %s', $v );
					if ( ! empty( $fields ) ) $wheres[] = implode( ' and ', $fields );
				}
				// if we have where statements for at least one row to remove
				if ( ! empty( $wheres ) ) {
					// glue the query together, and run it to delete the rows
					$q .= '(' . implode( ') or (', $wheres ) . ')';
					$wpdb->query( $q );
				}
			}
		}
	}

	// tell woocommerce what item meta to keep when a users moves from page to page, so that we dont lose vital ticket data
	public static function item_data_keys_to_maintain( $current ) {
		$current = is_array( $current ) ? $current : array();
		$current[] = 'event_id';
		$current[] = 'zone_id';
		return $current;
	}

	// fetch all reservations counts for an event by zone
	public static function all_event_zone_reservations( $res, $args='' ) {
		global $wpdb;

		$args = wp_parse_args( $args, array(
			'states' => '',
			'event' => '',
		) );

		$event_id = 0;
		if ( is_numeric( $args['event'] ) ) $event_id = $args['event'];
		if ( is_object( $args['event'] ) && isset( $args['event']->ID ) ) $event_id = $args['event']->ID;
		if ( $event_id <= 0 ) return $res;

		$args['states'] = is_array( $args['states'] ) ? array_filter( array_map( 'trim', $args['states'] ) ) : $args['states'];

		$q = $wpdb->prepare( 'select zone_id, sum(quantity) total from ' . $wpdb->qsot_event_zone_to_order . ' where event_id = %d', $event_id );
		if ( ! empty( $args['states'] ) ) {
			if ( is_string( $args['states'] ) ) $q .= $wpdb->prepare( ' and state = %s', $args['states'] );
			else if ( is_array( $args['states'] ) ) $q .= ' and state in ("' . implode( '","', array_map( 'esc_sql', $args['states'] ) ) . '")';
		}

		$q .= ' group by zone_id';

		$raw = $wpdb->get_results( $q );
		if ( ! empty( $raw ) ) {
			$res = array();
			foreach ( $raw as $row )
				$res[ $row->zone_id . '' ] = $row->total;
		}

		return $res;
	}

	// current_user is the id we use to lookup tickets in relation to a product in a cart. once we have an order number this pretty much becomes obsolete
	public static function current_user( $current, $order_id=false, $data='' ) {
		// if se previously calculated a value for this, serve that as the result
		//if ( isset( $_COOKIE['_qsotcu'] ) ) return $_COOKIE['_qsotcu'];

		// otherwise, try to create one based on the information we know
		global $woocommerce;
		$res = false;
		$data = wp_parse_args( $data, array( 'customer_user' => false ) );
		if ( $data['customer_user'] ) $res = $data['customer_user'];
		if ( empty( $res ) && (int)$order_id > 0 ) $res = get_post_meta( $order_id, '_customer_user', true );
		if ( empty( $res ) && is_object( $woocommerce->session ) ) $res = $woocommerce->session->get_customer_id();
		if ( empty( $res ) ) $res = $current;

		// store the resulting value so that it is only calculated once
		//$_COOKIE['_qsotcu'] = $res;
		//setcookie( '_qsotcu', $res, 0, '/' );

		return $res;
	}

	// add an interest for the current user
	public static function interest_current_user( $success, $event, $count=0, $zone_id=0 ) {
		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		$defs = array(
			'event' => null,
			'count' => 0,
			'zone_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
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
				'count' => $count,
				'zone_id' => $zone_id,
			), $defs );
		}

		// attempt to add the interest
		return apply_filters( 'qsot-zoner-interest', false, $args );
	}
	
	// add the interest
	public static function interest( $success, $event, $count=0, $customer_id=0, $order_id=0, $zone_id=0 ) {
		global $wpdb;

		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		// setup defaults and normalize the args
		$defs = array(
			'event' => null,
			'count' => 0,
			'customer_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
			'zone_id' => 0,
		);
		$args = array();

		// noramlize all arguments
		if ( is_array( $event ) ) {
			$args = wp_parse_args( $event, $defs );
		} else {
			$args = wp_parse_args( array(
				'event' => $event,
				'count' => $count,
				'customer_id' => $customer_id,
				'order_id' => $order_id,
				'zone_id' => $zone_id,
			), $defs );
		}

		extract( $args );

		// event is required infromation
		if ( ! is_object( $event ) )
			$event = apply_filters( 'qsot-get-event', false, $event );
		if ( ! is_object( $event ) ) return false;
		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );

		$is_zoned = false;
		// if the event has a seating chart that requires a zone, and no zone is present, then fail
		if ( isset( $event->zones ) && is_array( $event->zones ) && count( $event->zones ) ) {
			$is_zoned = true;
			if ( is_array( $zone_id ) ) {
				$zone_id = array_intersect( $zone_id, array_keys( $event->zones ) );
				if ( empty( $zone_id ) ) return 0;
				else if ( 1 == count( $zone_id ) ) $zone_id = array_pop( $zone_id );
			} else if ( $zone_id <= 0 || ! isset( $event->zones[ $zone_id . '' ] ) ) {
				return new WP_Error( 4, __( 'The selected zone does not belong to the selected event area.', 'qsot-seating' ) );
			}
		}

		if ( ! $is_zoned ) {
			return apply_filters( 'qsot-zoner-reserved', false, $args );
		}

		$zone_id = empty( $zone_id ) ? array() : ( is_array( $zone_id ) ? $zone_id : array( $zone_id ) );

		// if for some reason the count is negative (due to external plugin or hacker funny business) then do nothing, becasue it is impossible to have -1 seats
		if ( $count < 0 ) return false;
		// if setting the reservation count to 0, then delete reservations if they already exist
		else if ( $count == 0 ) {
			// generate the delete statement based on the supplied data
			$q = $wpdb->prepare( 'delete from ' . $wpdb->qsot_event_zone_to_order . ' where event_id = %s and state = %s', $event->ID, self::$o->{'z.states.i'} );

			// if the customer id was supplied, then add it
			if ( ! empty( $customer_id ) )
				$q .= $wpdb->prepare( ' and session_customer_id = %s', $customer_id );

			// if the order id was supplied, add it
			if ( (int)$order_id > 0 )
				$q .= $wpdb->prepare( ' and order_id = %d', (int)$order_id );

			// if the chart is zoned, and we have a zone, add it
			if ( $is_zoned and ! empty( $zone_id ) )
				$q .= ' and zone_id in( ' . implode( ',', array_map( 'intval', $zone_id ) ) . ')';

			// run the delete and store the status
			$res = $wpdb->query( $q );
			$success = !!$res;
		// if count is > 0 then
		} else {
			if ( $is_zoned ) {
				$total_int = apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => 0,
					'state' => self::$o->{'z.states.i'},
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) );

				$err = new WP_Error();

				foreach ( $zone_id as $zid ) {
					$available = apply_filters( 'qsot-zoner-get-event-zone-available', 0, (int)$zid, $event->ID );
					$ztotal_int = isset( $total_int[ $zid . '' ] ) ? array_sum( array_values( $total_int[ $zid . '' ] ) ) : 0;

					if ( $ztotal_int ) {
						if ( $count > ( $available - $ztotal_int ) ) {
							$err->add( 5, sprintf( __( 'There are not %s tickets available to reserve for %s.', 'qsot-seating' ), $count, $event->zones[ $zid . '' ]->name ) );
							continue;
						}

						$wpdb->update(
							$wpdb->qsot_event_zone_to_order,
							array( 'quantity' => $count ),
							array(
								'event_id' => $event->ID,
								'ticket_type_id' => 0,
								'session_customer_id' => $customer_id,
								'order_id' => $order_id,
								'zone_id' => $zid,
								'state' => self::$o->{'z.states.i'},
							)
						);
					} else {
						$wpdb->insert(
							$wpdb->qsot_event_zone_to_order,
							array(
								'event_id' => $event->ID,
								'ticket_type_id' => 0,
								'session_customer_id' => $customer_id,
								'order_id' => $order_id,
								'zone_id' => $zid,
								'quantity' => $count,
								'state' => self::$o->{'z.states.i'},
							)
						);
					}
				}

				if ( count( $err->get_error_messages() ) >= count( $zone_id ) ) {
					return $err;
				}

				$success = true;
			} else { // COPIED FROM OTCE -- for non-zoned seating
				$ticket_type_id = 0;
				// get the available occupancy of the event
				$available = apply_filters('qsot-get-event-available-tickets', 0, $event);
				// determine how many this person already has reserved
				$owns = array_sum( array_values( apply_filters('qsot-zoner-owns', 0, $event, 0, array( self::$o->{'z.states.r'}, self::$o->{'z.states.i'} ), $customer_id) ) );
				$owns_tt = array_sum( array_values( apply_filters('qsot-zoner-owns', 0, $event, $ticket_type_id, array( self::$o->{'z.states.r'}, self::$o->{'z.states.i'} ), $customer_id) ) );

				// if this user already owns some seats for this event, then 
				if ($owns_tt) {
					// if they are requesting more than is available, then just fail
					if ($count > ($available + $owns_tt - $owns))
						return new WP_Error(
							5,
							$count == 1
									? sprintf( __( 'There is not %s ticket available to reserve.', 'opentickets-community-edition' ), $count )
									: sprintf( __( 'There are not %s tickets available to reserve.', 'opentickets-community-edition' ), $count )
						);
					// otherwise update the reservation count for this user for this event
					$res = $wpdb->update(
						$wpdb->qsot_event_zone_to_order,
						array('quantity' => $count),
						array('event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'state' => self::$o->{'z.states.i'}, 'session_customer_id' => $customer_id, 'order_id' => $order_id)
					);
					$success = $res !== false;
				// if the user does not already have reservations for this event, then
				} else {
					// if the user is requesting more than what is currently available, then just fail
					if ($count > ($available + $owns_tt - $owns)) return new WP_Error( 5, sprintf( __( 'There are not %s tickets available to reserve.', 'opentickets-community-edition' ), $count ) );
					// oterhwise, insert the reservations for these seats now
					$res = $wpdb->insert(
						$wpdb->qsot_event_zone_to_order,
						array(
							'event_id' => $event->ID,
							'ticket_type_id' => $ticket_type_id,
							'quantity' => $count,
							'state' => self::$o->{'z.states.i'},
							'session_customer_id' => $customer_id,
							'order_id' => $order_id,
						)
					);
					$success = (bool)$res;
				}
			}
		}

		return $success;
	}

	// add a reservation for the current user
	public static function reserve_current_user( $success, $event, $ticket_type_id=0, $count=0, $zone_id=0 ) {
		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'count' => 0,
			'zone_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
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

		// attempt to add the reservation
		return apply_filters( 'qsot-zoner-reserved', false, $args );
	}
	
	// add the reservation
	public static function reserve( $success, $event, $ticket_type_id=0, $count=0, $customer_id=0, $order_id=0, $zone_id=0 ) {
		global $wpdb;

		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		// setup defaults and normalize the args
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'count' => 0,
			'customer_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
			'zone_id' => 0,
		);
		$args = array();

		// noramlize all arguments
		if ( is_array( $event ) ) {
			$args = wp_parse_args( $event, $defs );
		} else {
			$args = wp_parse_args( array(
				'event' => $event,
				'ticket_type_id' => $ticket_type_id,
				'count' => $count,
				'customer_id' => $customer_id,
				'order_id' => $order_id,
				'zone_id' => $zone_id,
			), $defs );
		}

		extract( $args );

		// event is required infromation
		if ( ! is_object( $event ) )
			$event = apply_filters( 'qsot-get-event', false, $event );
		if ( ! is_object( $event ) )
			return new WP_Error( 6, sprintf( __( 'No such event. [%d]', 'qsot-seating' ), $event->ID ) );
		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );

		$is_zoned = false;
		// if the event has a seating chart that requires a zone, and no zone is present, then fail
		if ( isset( $event->zones ) && is_array( $event->zones ) && count( $event->zones ) ) {
			$is_zoned = true;
			if ( is_array( $zone_id ) ) {
				$zone_id = array_intersect( $zone_id, array_keys( $event->zones ) );
				if ( empty( $zone_id ) ) return 0;
				else if ( 1 == count( $zone_id ) ) $zone_id = array_pop( $zone_id );
			} else if ( $zone_id <= 0 || ! isset( $event->zones[ $zone_id . '' ] ) ) {
				return new WP_Error( 4, __( 'The selected zone does not belong to the selected event area.', 'qsot-seating' ) );
			}
		}

		// if for some reason the count is negative (due to external plugin or hacker funny business) then do nothing, becasue it is impossible to have -1 seats
		if ( $count < 0 ) return false;
		// if setting the reservation count to 0, then delete reservations if they already exist
		else if ( $count == 0 ) {
			$res = $wpdb->delete(
				$wpdb->qsot_event_zone_to_order,
				array( 'event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'state' => self::$o->{'z.states.r'}, 'session_customer_id' => $customer_id, 'order_id' => $order_id, 'zone_id' => $zone_id )
			);
			$success = true;
		// if count is > 0 then
		} else {
			if ( $is_zoned ) {
				// gather information needed to determine proper update steps
				$available = apply_filters( 'qsot-zoner-get-event-zone-available', 0, (int)$zone_id, $event->ID );
				// find the total number of reservations for this zone by this user on this order/cart
				$res_ints = array_sum( array_values( apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => 0,
					'state' => array( self::$o->{'z.states.i'}, self::$o->{'z.states.r'} ),
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) ) ) );
				// find the total interests for this ticket_type, on this zone, by this user, in reference to this order/cart
				$interests_tt = apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => 0,
					'state' => self::$o->{'z.states.i'},
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) );
				if ( is_array( $interests_tt ) ) {
					if ( isset( $interests_tt[ $zone_id . '' ] ) )
						$interests_tt = is_array( $interests_tt[ $zone_id . '' ] ) ? array_sum( $interests_tt[ $zone_id . '' ] ) : 0;
					else
						$interests_tt = 0;
				}

				// find the total reserved for this ticket_type, on this zone, by this user, in reference to this order/cart
				$reserved_tt = apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => $ticket_type_id,
					'state' => self::$o->{'z.states.r'},
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) );
				if ( is_array( $reserved_tt ) ) {
					if ( isset( $reserved_tt[ $zone_id . '' ] ) )
						$reserved_tt = is_array( $reserved_tt[ $zone_id . '' ] ) ? array_sum( $reserved_tt[ $zone_id . '' ] ) : $reserved_tt[ $zone_id . '' ];
					else
						$reserved_tt = 0;
				}

				// if they already have interests or reservations, then allow them to modify those
				if ( $interests_tt + $reserved_tt ) {
					if ( $count > ( $available + $reserved_tt ) )
						return new WP_Error(
							5,
							$count == 1
									? sprintf( __( 'There is not %s ticket available to reserve. %d, %d, %d, %d', 'qsot-seating' ), $count, $available, $interests_tt, $reserved_tt, $res_ints )
									: sprintf( __( 'There are not %s tickets available to reserve. %d, %d, %d, %d', 'qsot-seating' ), $count, $available, $interests_tt, $reserved_tt, $res_ints )
						);

					$where = array( 'event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'session_customer_id' => $customer_id, 'order_id' => $order_id, 'zone_id' => $zone_id );
					
					if ( $interests_tt > 0 && $reserved_tt > 0 ) { // if there are rows for both interest and reserved currently recorded (rare), then condense to a single row
						// update the reserved row
						$where['state'] = self::$o->{'z.states.r'};
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'quantity' => $count ), $where );
						if ( ! $res )
							return new WP_Error( 7, __( 'Could not update your reservations.' . var_export( $wpdb, true ), 'qsot-seating' ) );

						$success = true;

						// delete the interest row
						$dwhere = $where;
						$dwhere['state'] = self::$o->{'z.states.i'};
						$wpdb->delete( $wpdb->qsot_event_zone_to_order, $dwhere );
					} else if ( $reserved_tt > 0 ) { // if there is already a 'reserved' row, then just use that and update the quantity (not common)
						$where['state'] = self::$o->{'z.states.r'};
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'quantity' => $count ), $where );
						if ( ! $res )
							return new WP_Error( 7, __( 'Could not update your reservations.' . var_export( $wpdb, true ), 'qsot-seating' ) );
						$success = true;
					} else { // if we got tis far, then there is only an 'interest' row. simply update that row to 'reserved' and update the quantity appropriately (very common)
						$where['state'] = self::$o->{'z.states.i'};
						unset( $where['ticket_type_id'] );
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'ticket_type_id' => $ticket_type_id, 'quantity' => $count, 'state' => self::$o->{'z.states.r'} ), $where );
						if ( ! $res )
							return new WP_Error( 7, __( 'Could not update your reservations.' . var_export( $wpdb, true ), 'qsot-seating' ) );
						$success = true;
					}
				// if they dont have either interests or reservations, then deny them
				} else {
					return new WP_Error( 6, __( 'You cannot reserve tickets in that zone.', 'qsot-seating' ) );
				}
			} else { // COPIED FROM OTCE -- for non-zoned seating
				// get the available occupancy of the event
				$available = apply_filters('qsot-get-event-available-tickets', 0, $event);
				// determine how many this person already has reserved
				$owns = apply_filters('qsot-zoner-owns', 0, $event, 0, self::$o->{'z.states.r'}, $customer_id);
				if ( is_array( $owns ) ) $owns = array_sum( array_values( $owns ) );
				$owns_tt = apply_filters( 'qsot-zoner-owns', 0, $event, array( 0, $ticket_type_id ), self::$o->{'z.states.r'}, $customer_id );
				if ( is_array( $owns_tt ) ) $owns_tt = array_sum( array_values( $owns_tt ) );

				// if this user already owns some seats for this event, then 
				if ($owns_tt) {
					// if they are requesting more than is available, then just fail
					if ($count > ($available + $owns_tt - $owns))
						return new WP_Error(
							5,
							$count == 1
									? sprintf( __( 'There is not %s ticket available to reserve.', 'opentickets-community-edition' ), $count )
									: sprintf( __( 'There are not %s tickets available to reserve.', 'opentickets-community-edition' ), $count )
						);
					// otherwise update the reservation count for this user for this event
					$res = $wpdb->update(
						$wpdb->qsot_event_zone_to_order,
						array('quantity' => $count),
						array('event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'state' => self::$o->{'z.states.r'}, 'session_customer_id' => $customer_id, 'order_id' => $order_id)
					);
					$success = $res !== false;
				// if the user does not already have reservations for this event, then
				} else {
					// if the user is requesting more than what is currently available, then just fail
					if ($count > ($available + $owns_tt - $owns)) return new WP_Error( 5, sprintf( __( 'There are not %s tickets available to reserve.', 'opentickets-community-edition' ), $count ) );
					// oterhwise, insert the reservations for these seats now
					$res = $wpdb->insert(
						$wpdb->qsot_event_zone_to_order,
						array(
							'event_id' => $event->ID,
							'ticket_type_id' => $ticket_type_id,
							'quantity' => $count,
							'state' => self::$o->{'z.states.r'},
							'session_customer_id' => $customer_id,
							'order_id' => $order_id,
						)
					);
					$success = (bool)$res;
				}
			}
		}

		return $success;
	}
	
	// add the reservation
	public static function confirm( $success, $event, $ticket_type_id=0, $count=0, $customer_id=0, $order_id=0, $zone_id=0 ) {
		global $wpdb;

		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		// setup defaults and normalize the args
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'count' => 0,
			'customer_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
			'zone_id' => 0,
		);
		$args = array();

		// noramlize all arguments
		if ( is_array( $event ) ) {
			$args = wp_parse_args( $event, $defs );
		} else {
			$args = wp_parse_args( array(
				'event' => $event,
				'ticket_type_id' => $ticket_type_id,
				'count' => $count,
				'customer_id' => $customer_id,
				'order_id' => $order_id,
				'zone_id' => $zone_id,
			), $defs );
		}

		extract( $args );

		// event is required infromation
		if ( ! is_object( $event ) )
			$event = apply_filters( 'qsot-get-event', false, $event );
		if ( ! is_object( $event ) )
			return new WP_Error( 6, sprintf( __( 'No such event. [%d]', 'qsot-seating' ), $event->ID ) );
		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );

		$is_zoned = false;
		// if the event has a seating chart that requires a zone, and no zone is present, then fail
		if ( isset( $event->zones ) && is_array( $event->zones ) && count( $event->zones ) ) {
			$is_zoned = true;
			if ( is_array( $zone_id ) ) {
				$zone_id = array_intersect( $zone_id, array_keys( $event->zones ) );
				if ( empty( $zone_id ) ) return 0;
				else if ( 1 == count( $zone_id ) ) $zone_id = array_pop( $zone_id );
			} else if ( $zone_id <= 0 || ! isset( $event->zones[ $zone_id . '' ] ) ) {
				return new WP_Error( 4, __( 'The selected zone does not belong to the selected event area.', 'qsot-seating' ) );
			}
		}

		// if for some reason the count is negative (due to external plugin or hacker funny business) then do nothing, becasue it is impossible to have -1 seats
		if ( $count < 0 ) return false;
		// if setting the reservation count to 0, then delete reservations if they already exist
		else if ( $count == 0 ) {
			$res = $wpdb->delete(
				$wpdb->qsot_event_zone_to_order,
				array( 'event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'state' => self::$o->{'z.states.c'}, 'session_customer_id' => $customer_id, 'order_id' => $order_id, 'zone_id' => $zone_id )
			);
			$success = true;
		// if count is > 0 then
		} else {
			if ( $is_zoned ) {
				// gather information needed to determine proper update steps
				$available = apply_filters( 'qsot-zoner-get-event-zone-available', 0, (int)$zone_id, $event->ID );
				// find the total number of reservations for this zone by this user on this order/cart
				$con_res_ints = array_sum( array_values( apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => 0,
					'state' => array( self::$o->{'z.states.i'}, self::$o->{'z.states.r'} ),
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) ) ) );

				// find the total interests for this ticket_type, on this zone, by this user, in reference to this order/cart
				$interests_tt = apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => 0,
					'state' => self::$o->{'z.states.i'},
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) );
				if ( is_array( $interests_tt ) ) {
					if ( isset( $interests_tt[ $zone_id . '' ] ) )
						$interests_tt = is_array( $interests_tt[ $zone_id . '' ] ) ? array_sum( $interests_tt[ $zone_id . '' ] ) : 0;
					else
						$interests_tt = 0;
				}

				// find the total reserved for this ticket_type, on this zone, by this user, in reference to this order/cart
				$reserved_tt = apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => $ticket_type_id,
					'state' => self::$o->{'z.states.r'},
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) );
				if ( is_array( $reserved_tt ) ) {
					if ( isset( $reserved_tt[ $zone_id . '' ] ) )
						$reserved_tt = is_array( $reserved_tt[ $zone_id . '' ] ) ? array_sum( $reserved_tt[ $zone_id . '' ] ) : 0;
					else
						$reserved_tt = 0;
				}

				// find the total confirmed for this ticket_type, on this zone, by this user, in reference to this order/cart
				$confirmed_tt = apply_filters( 'qsot-zoner-owns', 0, array(
					'event' => $event,
					'ticket_type_id' => $ticket_type_id,
					'state' => self::$o->{'z.states.c'},
					'customer_id' => $customer_id,
					'zone_id' => $zone_id
				) );
				if ( is_array( $confirmed_tt ) ) {
					if ( isset( $confirmed_tt[ $zone_id . '' ] ) )
						$confirmed_tt = is_array( $confirmed_tt[ $zone_id . '' ] ) ? array_sum( $confirmed_tt[ $zone_id . '' ] ) : 0;
					else
						$confirmed_tt = 0;
				}

				// if they already have interests or reservations, then allow them to modify those
				if ( $interests_tt + $reserved_tt + $confirmed_tt ) {
					if ( $count > ( $available + $interests_tt + $reserved_tt + $confirmed_tt - $con_res_ints ) )
						return new WP_Error(
							5,
							$count == 1
									? sprintf( __( 'There is not %s ticket available to confirm. %d, %d, %d, %d, %d', 'opentickets-community-edition' ), $count, $available, $interests_tt, $reserved_tt, $confirmed_tt, $con_res_ints )
									: sprintf( __( 'There are not %s tickets available to confirm. %d, %d, %d, %d, %d', 'opentickets-community-edition' ), $count, $available, $interests_tt, $reserved_tt, $confirmed_tt, $con_res_ints )
						);

					$where = array( 'event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'session_customer_id' => $customer_id, 'order_id' => $order_id, 'zone_id' => $zone_id );
					
					if ( ( $interests_tt > 0 || $reserved_tt > 0 ) && $confirmed_tt > 0 ) { // if there are rows for (interest or reserved) and confirmed currently recorded (rare), then condense to a single row
						// update the reserved row
						$where['state'] = self::$o->{'z.states.c'};
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'quantity' => $count ), $where );
						if ( ! $res )
							return new WP_Error( 7, __( 'Could not update your reservations.' . var_export( $wpdb, true ), 'qsot-seating' ) );

						$success = true;

						// delete the interest row
						$dwhere = $where;
						$dwhere['state'] = self::$o->{'z.states.i'};
						$wpdb->delete( $wpdb->qsot_event_zone_to_order, $dwhere );
						$dwhere['state'] = self::$o->{'z.states.r'};
						$wpdb->delete( $wpdb->qsot_event_zone_to_order, $dwhere );
					} else if ( $confirmed_tt > 0 ) { // if there is already a 'reserved' row, then just use that and update the quantity (not common)
						// update the existing confirm row to the proper count
						$where['state'] = self::$o->{'z.states.c'};
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'quantity' => $count ), $where );
						if ( ! $res )
							return new WP_Error( 7, __( 'Could not update your reservations.' . var_export( $wpdb, true ), 'qsot-seating' ) );
						$success = true;
					} else if ( $interests_tt > 0 && $reserved_tt > 0 ) { // if we have both interest and reserved rows but no confirmed rows, remove the interest, and update the reserved to confirmed
						// remove the interest row
						$dwhere = $where;
						$dwhere['state'] = self::$o->{'z.states.i'};
						$wpdb->delete( $wpdb->qsot_event_zone_to_order, $dwhere );

						// update the reserved row
						$where['state'] = self::$o->{'z.states.r'};
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'ticket_type_id' => $ticket_type_id, 'quantity' => $count, 'state' => self::$o->{'z.states.c'} ), $where );
						if ( ! $res )
							return new WP_Error( 7, __( 'Could not update your reservations.' . var_export( $wpdb, true ), 'qsot-seating' ) );
						$success = true;
					} else { // if we got tis far, then there is only an 'interest' or 'reserved' row. simply update that row to 'confirmed' and update the quantity appropriately (very common)
						// update the interest row
						$where['state'] = self::$o->{'z.states.i'};
						unset( $where['ticket_type_id'] );
						$res = $wpdb->update( $wpdb->qsot_event_zone_to_order, array( 'ticket_type_id' => $ticket_type_id, 'quantity' => $count, 'state' => self::$o->{'z.states.c'} ), $where );
						if ( false === $res )
							return new WP_Error( 7, __( 'Could not update your reservations. res=' . var_export( $res, true ) . '; wpdb=' . var_export( $wpdb, true ), 'qsot-seating' ) );
						$success = true;
					}
				// if they dont have either interests or reservations, then deny them
				} else {
					return new WP_Error( 6, __( 'You cannot reserve tickets in that zone.', 'qsot-seating' ) );
				}
			} else { // COPIED FROM OTCE -- for non-zoned seating
				// get the available occupancy of the event
				$available = apply_filters('qsot-get-event-available-tickets', 0, $event);
				// determine how many this person already has reserved
				$owns = array_sum( array_values( apply_filters('qsot-zoner-owns', 0, $event, 0, self::$o->{'z.states.r'}, $customer_id) ) );
				$owns_tt = array_sum( array_values( apply_filters('qsot-zoner-owns', 0, $event, $ticket_type_id, self::$o->{'z.states.r'}, $customer_id) ) );

				// if this user already owns some seats for this event, then 
				if ($owns_tt) {
					// if they are requesting more than is available, then just fail
					if ($count > ($available + $owns_tt - $owns))
						return new WP_Error(
							5,
							$count == 1
									? sprintf( __( 'There is not %s ticket available to reserve.', 'opentickets-community-edition' ), $count )
									: sprintf( __( 'There are not %s tickets available to reserve.', 'opentickets-community-edition' ), $count )
						);
					// otherwise update the reservation count for this user for this event
					$res = $wpdb->update(
						$wpdb->qsot_event_zone_to_order,
						array('quantity' => $count),
						array('event_id' => $event->ID, 'ticket_type_id' => $ticket_type_id, 'state' => self::$o->{'z.states.r'}, 'session_customer_id' => $customer_id, 'order_id' => $order_id)
					);
					$success = $res !== false;
				// if the user does not already have reservations for this event, then
				} else {
					// if the user is requesting more than what is currently available, then just fail
					if ($count > ($available + $owns_tt - $owns)) return new WP_Error( 5, sprintf( __( 'There are not %s tickets available to reserve.', 'opentickets-community-edition' ), $count ) );
					// oterhwise, insert the reservations for these seats now
					$res = $wpdb->insert(
						$wpdb->qsot_event_zone_to_order,
						array(
							'event_id' => $event->ID,
							'ticket_type_id' => $ticket_type_id,
							'quantity' => $count,
							'state' => self::$o->{'z.states.r'},
							'session_customer_id' => $customer_id,
							'order_id' => $order_id,
						)
					);
					$success = (bool)$res;
				}
			}
		}

		return $success;
	}

	// get the total reservations for each zone that the current user owns (based on event, ticket type, and state)
	public static function owns_current_user( $current, $event, $ticket_type_id=0, $state='', $zone_id=0 ) {
		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'state' => '',
			'zone_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
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
				'state' => $state,
				'zone_id' => $zone_id,
			), $defs );
		}

		return apply_filters( 'qsot-zoner-owns', false, $args );
	}

	// get the total reservations for each zone that a given user owns (based on event, ticket type, state, customer_id or order)
	public static function owns( $current, $event, $ticket_type_id=false, $state=false, $customer_id=false, $order_id=false, $order_item_id=false, $zone_id=0 ) {
		global $wpdb;

		$cur_order_id = absint( isset( WC()->session ) ? WC()->session->order_awaiting_payment : 0 );
		// normalize the argument
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'state' => '',
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
			'order_item_id' => 0,
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
				'state' => $state,
				'order_id' => $order_id,
				'order_item_id' => $order_item_id,
				'zone_id' => $zone_id,
			), $defs );
		}

		extract( $args );

		// event is required infromation
		if ( ! is_object( $event ) )
			$event = apply_filters( 'qsot-get-event', false, $event );
		if ( ! is_object( $event ) ) return false;
		$ea_id = isset( $event->meta, $event->meta->event_area ) ? $event->meta->event_area : 0;
		$event->zones = apply_filters( 'qsot-get-seating-zones', array(), $ea_id, 1 );

		$is_zoned = false;
		// if the event has a seating chart that requires a zone, and no zone is present, then fail
		if ( isset( $event->zones ) && is_array( $event->zones ) && count( $event->zones ) ) {
			$is_zoned = true;
			if ( is_array( $zone_id ) ) {
				$zone_id = array_intersect( $zone_id, array_keys( $event->zones ) );
				if ( empty( $zone_id ) ) return 0;
				else if ( 1 == count( $zone_id ) ) $zone_id = array_pop( $zone_id );
			}
		}
		
		// generate an sql statement that will pull out the reservation list based on the supplied information
		$q = $wpdb->prepare( 'select sum(quantity) as cnt, state, ticket_type_id, zone_id from ' . $wpdb->qsot_event_zone_to_order . ' where event_id = %d', $event->ID );

		// if the ticket type was supplied, then only get the tickets of that type for the event
		if ( ! empty( $ticket_type_id ) && $ticket_type_id != '*' ) {
			if ( is_array( $ticket_type_id ) ) $q .= ' and ticket_type_id in (' . implode( ',', array_map( 'absint', $ticket_type_id ) ) . ')';
			else $q .= $wpdb->prepare( ' and ticket_type_id = %d', $ticket_type_id );
		}

		// if the state was supplied, or it is 'all' states (*) then, add that to the query
		if ( ! empty( $state ) && $state != '*' ) {
			if ( is_array( $state ) ) $q .= ' and state in (\'' . implode( '\',\'', array_map( 'esc_sql', $state ) ) . '\')';
			else $q .= $wpdb->prepare( ' and state = %s', $state );
		}

		// if the zone_id was supplied, then add it to the query
		if ( $is_zoned && ( ( is_numeric( $zone_id ) && $zone_id > 0 ) || is_array( $zone_id ) ) ) {
			if ( is_array( $zone_id ) ) $q .= ' and zone_id in(' . implode( ',', array_map( 'intval', $zone_id ) ) . ')';
			else $q .= $wpdb->prepare( ' and zone_id = %d', $zone_id );
		}

		$subs = array();
		// if customer_id is supplied, add it to the query
		if ( ! empty( $customer_id ) ) {
			if ( is_array( $customer_id ) ) $subs[] = 'session_customer_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $customer_id ) ) . '\')';
			else $subs[] = $wpdb->prepare( 'session_customer_id = %s', $customer_id );
		}
		// if order_id is supplied, add it to the query
		if ( ! empty( $order_id ) ) {
			if ( is_array( $order_id ) ) $subs[] = 'order_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $order_id ) ) . '\')';
			else $subs[] = $wpdb->prepare( 'order_id = %s', $order_id );
		}
		// if order_item_id is supplied, add it to the query
		if ( ! empty( $order_item_id ) ) {
			if ( is_array( $order_item_id ) ) $subs[] = 'order_item_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $order_item_id ) ) . '\')';
			else $subs[] = $wpdb->prepare( 'order_item_id = %s', $order_item_id );
		}
		
		if ( ! empty( $subs ) ) $q .= ' and (' . implode( ' or ', $subs ) . ') ';

		$q .= ' group by state, ticket_type_id';

		// allow other plugins to add their logic
		$q = apply_filters( 'qsot-zoner-owns-query', $q, $event, $ticket_type_id, $state, $customer_id );
		$q = apply_filters( 'qsot-zoner-owns-query-from-args', $q, $args );

		// get the tallied results, grouped by state
		$counts = $wpdb->get_results( $q );
		$indexed = array();

		if ( $is_zoned ) {
			// format the results in a useable form
			foreach ( $counts as $count ) {
				$indexed[ $count->zone_id ] = isset( $indexed[ $count->zone_id ] ) ? $indexed[ $count->zone_id ] : array();
				$indexed[ $count->zone_id ][ $count->state ] = isset( $indexed[ $count->zone_id ][ $count->state ] ) ? $indexed[ $count->zone_id ][ $count->state ] : array();
				$indexed[ $count->zone_id ][ $count->state ][ $count->ticket_type_id ] = $count->cnt;
			}

			if ( ! is_array( $ticket_type_id ) && ! empty( $ticket_type_id ) && $ticket_type_id != '*' ) {
				foreach ( $indexed as $zid => $indxd )
					foreach ( $indxd as $st => $cnts )
						$indexed[ $zid ][ $st ] = array_sum( array_values( $cnts ) );

				// if all results were requested, or if there are no results, then just return the whole list
				if ( empty( $state ) || $state == '*' || is_array( $state ) ) return $indexed;

				$out = array();
				foreach ( $indexed as $zid => $indxd ) {
					foreach ( $indxd as $st => $cnts ) {
						if ( $state == $st ) {
							$out[ $zid ] = $cnts;
							break;
						}
					}
				}

				// otherwise, we need to only return a specific resultset, based on requested state
				return $out;
			} else {
				// if all results were requested, or if there are no results, then just return the whole list
				if ( empty( $state ) || $state == '*' || is_array( $state ) ) return $indexed;

				$out = array();
				foreach ( $indexed as $zid => $indxd ) {
					foreach ( $indxd as $st => $cnts ) {
						if ( $state == $st ) {
							$out[ $zid ] = $cnts;
							break;
						}
					}
				}

				// otherwise, we need to only return a specific resultset, based on requested state
				return $out;
			}
		} else {
			// format the results in a useable form
			foreach ( $counts as $count ) {
				$indexed[ $count->state ] = isset( $indexed[ $count->state ] ) ? $indexed[ $count->state ] : array();
				$indexed[ $count->state ][ $count->ticket_type_id ] = $count->cnt;
			}

			if ( ! is_array($ticket_type_id) && ! empty( $ticket_type_id ) && $ticket_type_id != '*' ) {
				foreach ( $indexed as $st => $cnts )
					$indexed[ $st ] = array_sum( array_values( $cnts ) );

				// if all results were requested, or if there are no results, then just return the whole list
				if ( empty( $state ) || $state == '*' || is_array( $state ) ) return $indexed;

				// otherwise, we need to only return a specific resultset, based on requested state
				return isset( $indexed[ $state ] ) ? $indexed[ $state ] : 0;
			} else {
				// if all results were requested, or if there are no results, then just return the whole list
				if ( empty( $state ) || $state == '*' || is_array( $state ) ) return $indexed;

				// otherwise, we need to only return a specific resultset, based on requested state
				return isset( $indexed[ $state ] ) ? $indexed[ $state ] : array();
			}
		}
	}

	// get the list of actual zones that the current user has reservations for (based on event, ticket type, and state)
	public static function ownerships_current_user( $current, $event=0, $ticket_type_id=0, $state=false, $zone_id=0 ) {
		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'state' => '',
			'zone_id' => 0,
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
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
				'state' => $state,
				'zone_id' => $zone_id,
			), $defs );
		}

		// get the zone list
		return apply_filters( 'qsot-zoner-ownerships', $current, $args );
	}

	// get the list of actual zones that the _given_ user (and/or order_id, and/or order_item_id) has reservations for (based on event, ticket type, and state)
	public static function ownerships( $current, $event=0, $ticket_type_id=0, $state=false, $customer_id=false, $order_id=false, $order_item_id=false, $zone_id=0 ) {
		global $wpdb;

		$cur_order_id = absint( WC()->session->order_awaiting_payment );
		// normalize the argument
		$defs = array(
			'event' => null,
			'ticket_type_id' => 0,
			'state' => '',
			'order_id' => $cur_order_id > 0 ? $cur_order_id : 0,
			'order_item_id' => 0,
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
				'state' => $state,
				'order_id' => $order_id,
				'order_item_id' => $order_item_id,
				'zone_id' => $zone_id,
			), $defs );
		}

		extract( $args );

		// event is required information here
		$event = is_numeric( $event ) && $event > 0 ? apply_filters( 'qsot-get-event', false, $event ) : $event;
		//if ( ! is_object( $event ) ) return array();

		// build a query to pull the whole list zones this user owns
		$q = 'select * from ' . $wpdb->qsot_event_zone_to_order . ' where 1=1';
		// if the event was supplied, add it to the query to narrow the results
		if ( is_object( $event ) ) {
			$q .= $wpdb->prepare( ' and event_id = %d', $event->ID );
		}
		// if the ticket type (product_id) was supplied, add to the query to narrow results
		if ( $ticket_type_id > 0 ) {
			$q .= $wpdb->prepare( ' and ticket_type_id = %d', $ticket_type_id );
		}
		// if the ticket type (product_id) was supplied, add to the query to narrow results
		if ( $zone_id > 0 ) {
			$q .= $wpdb->prepare( ' and zone_id = %d', $zone_id );
		}
		// if the state was supplied, add it to the query to narrow....
		if ( ! empty( $state ) && $state != '*' ) {
			if ( is_array( $state ) ) $q .= ' and state in (\'' . implode( '\',\'', array_map( 'esc_sql', $state ) ) . '\')';
			else $q .= $wpdb->prepare( ' and state = %s', $state );
		}
		// if for specific user, add it to query....
		if ( ! empty( $customer_id ) ) {
			if ( is_array( $customer_id ) ) $q .= ' and session_customer_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $customer_id ) ) . '\')';
			else $q .= $wpdb->prepare( ' and session_customer_id = %s', $customer_id );
		}
		// if for specific order_id, add it to query....
		if ( ! empty( $order_id ) ) {
			if ( is_array( $order_id ) ) $q .= ' and order_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $order_id ) ) . '\')';
			else $q .= $wpdb->prepare( ' and order_id = %s', $order_id );
		}
		// if for specific order_item_id, add it to query....
		if ( ! empty( $order_item_id ) ) {
			if ( is_array( $order_item_id ) ) $q .= ' and order_item_id in(\'' . implode( '\',\'', array_map( 'esc_sql', $order_item_id ) ) . '\')';
			else $q .= $wpdb->prepare( ' and order_item_id = %s', $order_item_id );
		}

		// allow external plugins to add their logic here
		$q = apply_filters( 'qsot-zoner-ownerships-query', $q, $event, $ticket_type_id, $state, $customer_id, $order_id, $order_item_id );

		// fetch the list
		$raw = $wpdb->get_results( $q );
		$indexed = array();
		// organize the list
		foreach ( $raw as $row ) {
			$indexed[ $row->state ] = isset( $indexed[ $row->state ] ) && is_array( $indexed[ $row->state ] ) ? $indexed[ $row->state ] : array();
			$indexed[ $row->state ][] = $row;
		}

		// we have no results, we requested all results, or we requested multiple state results, then just return the whole resultset
		if ( empty( $indexed ) || empty( $state ) || $state == '*' || is_array( $state ) ) return $indexed;

		// otherwise only return the specified results
		return isset( $indexed[ $state ] ) ? $indexed[ $state ] : array();
	}

	// update/delete existing reservations
	public static function update_reservation($success, $where, $set) {
		global $wpdb;
		$is_delete = false;

		// generate the 'where statement' pieces for the sql query to perform the actual update
		$wheres = array();
		// if the order item id was given, add it
		if (isset($where['order_item_id'])) {
			if (is_array($where['order_item_id'])) $wheres[] = ' and order_item_id in('.implode(',', $where['order_item_id']).')';
			else $wheres['order_item_id'] = $wpdb->prepare(' and order_item_id = %d', $where['order_item_id']);
		}
		// if the zone id was given, add it
		if (isset($where['zone_id'])) {
			if (is_array($where['zone_id'])) $wheres[] = ' and zone_id in('.implode(',', $where['zone_id']).')';
			else $wheres['zone_id'] = $wpdb->prepare(' and zone_id = %d', $where['zone_id']);
		}
		// if the order id was given, add it
		if (isset($where['order_id'])) {
			if (is_array($where['order_id'])) $wheres[] = ' and order_id in('.implode(',', $where['order_id']).')';
			else $wheres['order_id'] = $wpdb->prepare(' and order_id = %d', $where['order_id']);
		}
		// if the customer was specified, add it
		if (isset($where['customer_id'])) {
			if (is_array($where['customer_id'])) $wheres[] = ' and session_customer_id in(\''.implode('\',\'', $where['customer_id']).'\')';
			else $wheres['customer_id'] = $wpdb->prepare(' and session_customer_id = %s', $where['customer_id']);
		}
		// if the state was given, add it
		if (isset($where['state']) && $where['state'] != '*') {
			if (is_array($where['state'])) $wheres[] = ' and state in (\''.implode('\',\'', $where['state']).'\')';
			else $wheres['state'] = $wpdb->prepare(' and state = %s', $where['state']);
		}
		// if the event id was given, add it
		if (isset($where['event_id'])) {
			if (is_array($where['event_id'])) $wheres[] = ' and event_id in ('.implode(',', $where['event_id']).')';
			else $wheres['event_id'] = $wpdb->prepare(' and event_id = %d', $where['event_id']);
		}
		// if the product_id of the ticket type was given, add it
		if (isset($where['ticket_type_id'])) {
			if (is_array($where['ticket_type_id'])) $wheres[] = ' and ticket_type_id in ('.implode(',', $where['ticket_type_id']).')';
			else $wheres['ticket_type_id'] = $wpdb->prepare(' and ticket_type_id = %d', $where['ticket_type_id']);
		}
		// if a quantity was specified, add it
		if (isset($where['qty'])) {
			if (is_array($where['qty'])) $wheres[] = ' and qty in ('.implode(',', $where['qty']).')';
			else $wheres['qty'] = $wpdb->prepare(' and quantity = %d', $where['qty']);
		}
		// allow external plugins to modify this with their logic
		$wheres = apply_filters('qsot-zoner-update-reservation-wheres', $wheres, $set, $where);

		// generate the 'where statement' pieces for the sql query to perform the removal of existing records, prior to the actual update
		$set_wheres = array();
		// if the order item id was given, add it
		if (isset($set['order_item_id'])) {
			if (is_array($set['order_item_id'])) $set_wheres[] = ' and order_item_id in('.implode(',', $set['order_item_id']).')';
			else $set_wheres['order_item_id'] = $wpdb->prepare(' and order_item_id = %d', $set['order_item_id']);
		}
		// if the zone id was given, add it
		if (isset($set['zone_id'])) {
			if (is_array($set['zone_id'])) $set_wheres[] = ' and zone_id in('.implode(',', $set['zone_id']).')';
			else $set_wheres['zone_id'] = $wpdb->prepare(' and zone_id = %d', $set['zone_id']);
		}
		// if the order id was given, add it
		if (isset($set['order_id'])) {
			if (is_array($set['order_id'])) $set_wheres[] = ' and order_id in('.implode(',', $set['order_id']).')';
			else $set_wheres['order_id'] = $wpdb->prepare(' and order_id = %d', $set['order_id']);
		}
		// if the customer was specified, add it
		if (isset($set['customer_id'])) {
			if (is_array($set['customer_id'])) $set_wheres[] = ' and session_customer_id in(\''.implode('\',\'', $set['customer_id']).'\')';
			else $set_wheres['customer_id'] = $wpdb->prepare(' and session_customer_id = %s', $set['customer_id']);
		}
		// if a specific state (or group of states) was requested, add it
		if (isset($set['state']) && $set['state'] != '*') {
			if (is_array($set['state'])) $set_wheres[] = ' and state in (\''.implode('\',\'', $set['state']).'\')';
			else $set_wheres['state'] = $wpdb->prepare(' and state = %s', $set['state']);
		}
		// if the event id was given, add it
		if (isset($set['event_id'])) {
			if (is_array($set['event_id'])) $set_wheres[] = ' and event_id in ('.implode(',', $set['event_id']).')';
			else $set_wheres['event_id'] = $wpdb->prepare(' and event_id = %d', $set['event_id']);
		}
		// if the product_id of the ticket type was specified, add it
		if (isset($set['ticket_type_id'])) {
			if (is_array($set['ticket_type_id'])) $set_wheres[] = ' and ticket_type_id in ('.implode(',', $set['ticket_type_id']).')';
			else $set_wheres['ticket_type_id'] = $wpdb->prepare(' and ticket_type_id = %d', $set['ticket_type_id']);
		}

		// normalize the where statements for the update and deletion prior to update
		if (!empty($set_wheres)) {
			$set_wheres = wp_parse_args($set_wheres, $wheres);
			// we will be updating the quantity, so we c
			unset($set_wheres['qty']);
		}

		$limit = '';
		// if we are trying to delete the reservations, then start the update query as a delete statement
		if (isset($set['_delete']) || (isset($set['qty']) && ! in_array( $set['qty'], array( '::INC::', '::DEC::' ) ) && $set['qty'] <= 0)) {
			$q = 'delete from '.$wpdb->qsot_event_zone_to_order.' where 1=1';
			// also update passed information for the action below
			$set['_qty'] = $set['qty'];
			$set['qty'] = 0;
			$is_delete = true;
		// otherwise this is an actual, genuine update to the reservations, so make the query an update query
		} else {
			$q = 'update '.$wpdb->qsot_event_zone_to_order.' set ';
			// create the update sql
			$pairs = array();
			if (isset($set['order_item_id'])) $pairs[] = $wpdb->prepare(' order_item_id = %d', $set['order_item_id']);
			if (isset($set['zone_id'])) $pairs[] = $wpdb->prepare(' zone_id = %d', $set['zone_id']);
			if (isset($set['order_id'])) $pairs[] = $wpdb->prepare(' order_id = %d', $set['order_id']);
			if (isset($set['customer_id'])) $pairs[] = $wpdb->prepare(' session_customer_id = %s', $set['customer_id']);
			if (isset($set['state'])) $pairs[] = $wpdb->prepare(' state = %s', $set['state']);
			if (isset($set['event_id'])) $pairs[] = $wpdb->prepare(' event_id = %d', $set['event_id']);
			if (isset($set['ticket_type_id'])) $pairs[] = $wpdb->prepare(' ticket_type_id = %d', $set['ticket_type_id']);
			if (isset($set['qty'])) {
				if ($set['qty'] == '::DEC::') $pairs[] = ' quantity = quantity - 1 ';
				else if ($set['qty'] == '::INC::') $pairs[] = ' quantity = quantity + 1 ';
				else $pairs[] = $wpdb->prepare(' quantity = %d', $set['qty']);
			}
			// allow other plugins to add their own update stuff
			$pairs = apply_filters('qsot-zoner-update-reservation-sets', $pairs, $set, $where);
			// glue it all together
			$q .= implode(',', $pairs).' where 1=1';
			$limit = ' limit 1';
		}

		// if we actually have updates to make, because we actually have data to filter our updated set by (in other words, do not delete all records accidentally)
		if (is_array($wheres) && count($wheres)) { // safegaurd against deleting all records
			$set['qty'] = isset($set['qty']) ? $set['qty'] : 0;
			// pull out the existing reservations, and pass them on to external plugins, notifying them that they will be updated
			$wheres = array_values($wheres);
			$cur = $wpdb->get_results('select * from '.$wpdb->qsot_event_zone_to_order.' where 1=1'.implode('', $wheres));
			$total = 0;
			foreach ($cur as $item) $total += $item->quantity;
			$change = -$total + $set['qty'];

			// tell other plugins that we are updating these rows
			do_action('qsot-zoner-before-update-reservation', $change, $set['qty'], $cur, $where, $set);

			// if for some reason we have some duplicate entries with close to the same data represented as the data we are coming _from_, then delete all but one of them
			if (count($cur) > 1) {
				// remove any weird duplicate entries.
				$wpdb->query($wpdb->prepare('delete from '.$wpdb->qsot_event_zone_to_order.' where 1=1'.implode('', $wheres).' order by since desc limit %d', count($cur) - 1));
			}

			// if this is an update, remove any data that looks like the data we are going _to_
			/*@@@@LOUSHOU - removed because it causes problems. possible rethink needed
			if (!empty($set_wheres) && !$is_delete) {
				$set_wheres = array_values($set_wheres);
				//$wpdb->query('delete from '.$wpdb->qsot_event_zone_to_order.' where 1=1'.implode('', $set_wheres));
			}
			*/

			// glue the query
			$q .= implode('', $wheres).$limit;

			// actually run the update, be it delete or update
			$res = $wpdb->query($q);

			// commit the query. why do i have to do this now, when it was never required before.
			$wpdb->query('commit');
			$success = $res !== false;
	
			// notify other plugins of our success
			if ($success)
				do_action('qsot-zoner-after-update-reservation', $change, $set['qty'], $where, $set);
		}

		return $success;
	}

	public static function setup_table_names() {
		global $wpdb;

		$wpdb->qsot_seating_zones = $wpdb->prefix . 'qsot_seating_zones';
		$wpdb->qsot_seating_zonemeta = $wpdb->prefix . 'qsot_seating_zonemeta';
		$wpdb->qsot_event_zone_to_order = $wpdb->prefix . 'qsot_event_zone_to_order';
	}
}

if ( defined( 'ABSPATH' ) && function_exists( 'add_action' ) ) QSOT_zoner::pre_init();
