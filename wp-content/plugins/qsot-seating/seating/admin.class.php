<?php (__FILE__ == $_SERVER['SCRIPT_FILENAME']) ? die(header('Location: /')) : null;

if ( ! is_admin() ) return;

class QSOT_seating_admin {
	protected static $o = null;

	public static function pre_init() {
		// first thing, load all the options, and share them with all other parts of the plugin
		$settings_class_name = apply_filters('qsot-settings-class-name', '');
		if (!class_exists($settings_class_name)) return false;
		self::$o = call_user_func_array(array($settings_class_name, "instance"), array());

		if ( true || QSOT_addon_registry::instance()->is_activated( QSOT_multi_price_launcher::me() ) ) {
			// register our admin scripts and styles
			add_action( 'init', array( __CLASS__, 'register_assets' ), 10001 );

			// actually queue the scripts and styles for specific pages in the admin
			add_action( 'admin_enqueue_scripts', array( __CLASS__, 'admin_enqueue_assets' ), 1000, 1 );
			add_action( 'qsot-admin-load-assets-qsot-event-area', array( __CLASS__, 'assets_edit_event_area' ), 1000, 2 );

			// add our seating chart metabox
			add_action( 'add_meta_boxes', array( __CLASS__, 'metaboxes' ), 100000, 2 );

			// save seating chart filter
			add_action( 'save_post_qsot-event-area', array( __CLASS__, 'save_post' ), 5, 3 );

			// edit event page stuff
			// load assets
			add_filter( 'qsot-admin-load-assets-qsot-event', array( __CLASS__, 'admin_event_assets' ), 10, 2 );
			// add to the interface
			add_action( 'plugins_loaded', array( __CLASS__, 'event_settings_ui' ), 1000, 1 );
			// accept interface based changes to settings, and integrate into the event save & load procedures
			add_filter( 'qsot-load-child-event-settings', array( __CLASS__, 'load_child_event_settings' ), 10, 3 );
			add_filter( 'qsot-events-save-sub-event-settings', array( __CLASS__, 'save_sub_event_settings' ), 10, 3 );
		}
	}

	public static function register_assets() {
		$version = QSOT_seating_launcher::version();
		$url = QSOT_seating_launcher::plugin_url() . 'assets/';
		$debug = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '' : '.min';

		// jack the woocommerce ajax chosen. plan to move to select2 at some point
		wp_register_style( 'qsot-chosen', WC()->plugin_url() . '/assets/css/chosen.css', array(), '2.3.5' );

		// seating chart drawing ui
		wp_register_script( 'qsot-browser-storage', $url . 'js/admin/browser-storage.js', array( 'qsot-seating-tools' ), $version );
		wp_register_script( 'qsot-seating-admin-draw', $url . 'js/admin/draw.js', array( 'snapsvg', 'wp-color-picker', 'qsot-browser-storage', 'jquery-ui-dialog' ), $version );
		wp_register_style( 'qsot-seating-admin', $url . 'css/admin/base.css', array( 'qsot-base-admin', 'wp-jquery-ui-dialog' ), $version );

		// admin pricing tool
		wp_register_script( 'qsot-admin-price-struct', $url . 'js/admin/price.js', array( 'qsot-tools', 'chosen', 'jquery-ui-dialog' ), $version );

		// integrate into the events page
		wp_register_script( 'qsot-seating-event-settings', $url . 'js/admin/event-settings.js', array( 'qsot-events-admin-edit-page' ), $version );
	}

	public static function admin_enqueue_assets( $hook ) {
		wp_enqueue_media();
		wp_enqueue_style( 'qsot-seating-admin' );
	}

	// setup our js and css needed on the seating chart ui pages in the admin
	public static function assets_edit_event_area( $exists, $post_id ) {
		// aggregate a list of all the ticket products. used for the pricing structure ui
		$tickets = apply_filters( 'qsot-get-all-ticket-products', array(), 'objects' );
		foreach ( $tickets as $ticket ) {
			$ticket->formatted_price = wc_price( $ticket->get_display_price() ) . $ticket->get_price_suffix();
			$ticket->formatted_display = apply_filters( 'the_title', $ticket->post->post_title ) . ' (' . $ticket->formatted_price . ')';
			$ticket->text_display = strip_tags( $ticket->formatted_display );
		}

		// get a list of all the current pricing structs for this chart
		$price_structs = apply_filters( 'qsot-get-price-structures', array(), array( 'event_area_id' => $post_id, 'price_list_format' => 'ids' ) );

		// enqueue our core UI drawing tool
		wp_enqueue_script( 'qsot-seating-admin-draw' );
		wp_localize_script( 'qsot-seating-admin-draw', '_qsot_seating_draw', array(
			'data' => array(
				'zones' => apply_filters( 'qsot-get-seating-zones', array(), $post_id, 1 ),
				'zoom_zones' => apply_filters( 'qsot-get-seating-zones', array(), $post_id, 2 ),
			),
			'strings' => array(
				'Bounding box must be a rectangle.' => __( 'Bounding box must be a rectangle.', 'qsot-seating' ),
				'Yes' => __( 'Yes', 'qsot-seating' ),
				'pattern' => __( 'pattern', 'qsot-seating' ),
				'replace' => __( 'replace', 'qsot-seating' ),
				'What is the naming pattern you would like to use?' => __( 'What is the naming pattern you would like to use?', 'qsot-seating' ),
				"^ = A-Z<br/>@ = a-z<br/># = 0-9<br/>[x,y] = start from value 'x', alternate every 'y'<br/>(ex: 'north-@[b]-#[3,2]' = odd numbered seats starting at 'north-b-3')" =>
						__( "^ = A-Z<br/>@ = a-z<br/># = 0-9<br/>[x,y] = start from value 'x', alternate every 'y'<br/>(ex: 'north-@[b]-#[3,2]' = odd numbered seats starting at 'north-b-3')" ),
				'Draw a line in the direction of numbers lowest to highest.' => __( 'Draw a line in the direction of numbers lowest to highest.', 'qsot-seating' ),
				'Draw a line in the direction of letters "a" to "z".' => __( 'Draw a line in the direction of letters "a" to "z".', 'qsot-seating' ),
				'Draw a line in the direction of letters "A" to "Z".' => __( 'Draw a line in the direction of letters "A" to "Z".', 'qsot-seating' ),
				'the line must be at least 5px long.' => __( 'the line must be at least 5px long.', 'qsot-seating' ),
				'What text would you like to find, within each name (regex without delimiters is accepted)?' => __( 'What text would you like to find, within each name (regex without delimiters is accepted)?', 'qsot-seating' ),
				'What would you like to replace "%s" with, within each name?' => __( 'What would you like to replace "%s" with, within each name?', 'qsot-seating' ),
				'What to find:' => __( 'What to find:', 'qsot-seating' ),
				'Replace it with what?' => __( 'Replace it with what?', 'qsot-seating' ),
				'show advanced' => __( 'show advanced', 'qsot-seating' ),
				'hide advanced' => __( 'hide advanced', 'qsot-seating' ),
				'Zoom-In' => __( 'Zoom-In', 'qsot-seating' ),
				'Zoom-Out' => __( 'Zoom-Out', 'qsot-seating' ),
				'Button' => __( 'Button', 'qsot-seating' ),
				'Distraction Free' => __( 'Distraction Free', 'qsot-seating' ),
				'Undo' => __( 'Undo', 'qsot-seating' ),
				'Redo' => __( 'Redo', 'qsot-seating' ),
				'True ID' => __( 'True ID', 'qsot-seating' ),
				'Unique ID' => __( 'Unique ID', 'qsot-seating' ),
				'Think of this as the "slug" to identify this zone uniquely from the others, like a post would have.' =>
						__( 'Think of this as the "slug" to identify this zone uniquely from the others, like a post would have.', 'qsot-seating' ),
				'Name' => __( 'Name', 'qsot-seating' ),
				'The proper name of this zone, displayed in most locations that this zone needs to be identified, like on tickets, carts, or ticket selection UIs.' => __( 'The proper name of this zone, displayed in most locations that this zone needs to be identified, like on tickets, carts, or ticket selection UIs.', 'qsot-seating' ),
				'Capacity' => __( 'Capacity', 'qsot-seating' ),
				'The maximum number of tickets that can be sold for this zone, on a given event.' => __( 'The maximum number of tickets that can be sold for this zone, on a given event.', 'qsot-seating' ),
				'Fill Color' => __( 'Fill Color', 'qsot-seating' ),
				'What color should the inside of the shape for this zone be?' => __( 'What color should the inside of the shape for this zone be?', 'qsot-seating' ),
				'Hidden on Frontend' => __( 'Hidden on Frontend', 'qsot-seating' ),
				'If yes, then this element does not get displayed to the end user.' => __( 'If yes, then this element does not get displayed to the end user.', 'qsot-seating' ),
				'Locked in Place' => __( 'Locked in Place', 'qsot-seating' ),
				'If yes, then attempts to drag this element will not work.' => __( 'If yes, then attempts to drag this element will not work.', 'qsot-seating' ),
				'Fill Transparency' => __( 'Fill Transparency', 'qsot-seating' ),
				'Transparency of the inside of the zone.' => __( 'Transparency of the inside of the zone.', 'qsot-seating' ),
				'Unavailable Color' => __( 'Unavailable Color', 'qsot-seating' ),
				'What color should the inside of the zone be when it has reached capacity?' => __( 'What color should the inside of the zone be when it has reached capacity?', 'qsot-seating' ),
				'Unavailable Transparency' => __( 'Unavailable Transparency', 'qsot-seating' ),
				'Transparency of the inside of the zone, when at capacity' => __( 'Transparency of the inside of the zone, when at capacity', 'qsot-seating' ),
				'Angle' => __( 'Angle', 'qsot-seating' ),
				'Show Level' => __( 'Show Level', 'qsot-seating' ),
				'Show this zoom zone when zoom level is less than or equal to this number.' => __( 'Show this zoom zone when zoom level is less than or equal to this number.', 'qsot-seating' ),
				'Image ID' => __( 'Image ID', 'qsot-seating' ),
				'Source' => __( 'Source', 'qsot-seating' ),
				'Image Width' => __( 'Image Width', 'qsot-seating' ),
				'Image Height' => __( 'Image Height', 'qsot-seating' ),
				'Image Offset X' => __( 'Image Offset X', 'qsot-seating' ),
				'Image Offset Y' => __( 'Image Offset Y', 'qsot-seating' ),
				'Backdrop Image' => __( 'Backdrop Image', 'qsot-seating' ),
				'If yes, then the displayed canvas on the frontend will use this image as the background image of the interface' =>
						__( 'If yes, then the displayed canvas on the frontend will use this image as the background image of the interface', 'qsot-seating' ),
				'X Center' => __( 'X Center', 'qsot-seating' ),
				'Y Center' => __( 'Y Center', 'qsot-seating' ),
				'Radius' => __( 'Radius', 'qsot-seating' ),
				'X Center' => __( 'X Center', 'qsot-seating' ),
				'Y Center' => __( 'Y Center', 'qsot-seating' ),
				'Radius X' => __( 'Radius X', 'qsot-seating' ),
				'Radius Y' => __( 'Radius Y', 'qsot-seating' ),
				'Color on Hover' => __( 'Color on Hover', 'qsot-seating' ),
				'Background color when element is hovered.' => __( 'Background color when element is hovered.', 'qsot-seating' ),
				'Opacity on Hover' => __( 'Opacity on Hover', 'qsot-seating' ),
				'Background opacity when element is hovered.' => __( 'Background opacity when element is hovered.', 'qsot-seating' ),
				'Show Max Zoom Level' => __( 'Show Max Zoom Level', 'qsot-seating' ),
				'Only show when the zoom is equal to or less than this value.' => __( 'Only show when the zoom is equal to or less than this value.', 'qsot-seating' ),
				'X Upper Left' => __( 'X Upper Left', 'qsot-seating' ),
				'Y Upper Left' => __( 'Y Upper Left', 'qsot-seating' ),
				'Width' => __( 'Width', 'qsot-seating' ),
				'Height' => __( 'Height', 'qsot-seating' ),
				'X Upper Left' => __( 'X Upper Left', 'qsot-seating' ),
				'Y Upper Left' => __( 'Y Upper Left', 'qsot-seating' ),
				'Path Points' => __( 'Path Points', 'qsot-seating' ),
				'space between points and comma between x and xy: (ei: 0,0 10,0 10,10 0,10)' => __( 'space between points and comma between x and xy: (ei: 0,0 10,0 10,10 0,10)', 'qsot-seating' ),
				'Send to Back' => __( 'Send to Back', 'qsot-seating' ),
				'Bring to Front' => __( 'Bring to Front', 'qsot-seating' ),
				'Mass Selection (Marquee Tool)' => __( 'Mass Selection (Marquee Tool)', 'qsot-seating' ),
				'Fill Color' => __( 'Fill Color', 'qsot-seating' ),
				'No SNAPSVG canvas specified. Buttonbar cannot initialize.' => __( 'No SNAPSVG canvas specified. Buttonbar cannot initialize.', 'qsot-seating' ),
				'Pointer Tool' => __( 'Pointer Tool', 'qsot-seating' ),
				'Toggle Zoom Zones' => __( 'Toggle Zoom Zones', 'qsot-seating' ),
			),
		) );
		// enqueue the pricing control addon
		wp_enqueue_script( 'qsot-admin-price-struct' );
		wp_localize_script( 'qsot-admin-price-struct', '_qsot_price_struct', array(
			'data' => array(
				'tickets' => (object)$tickets,
				'structs' => (object)$price_structs,
			),
			'strings' => array(
				'what_name' => __( 'What is the name of the new Price Structure? (example: "Daytime Pricing")', 'qsot-seating' ),
				'change_name' => __( 'What would you like to change the name of "%s" to? (example: "Daytime Pricing")', 'qsot-seating' ),
				'structs' => __( 'Price Struct', 'qsot-seating' ),
				'tickets' => __( 'Tickets in Struct', ' qsot-seating' ),
				'new' => __( 'new', 'qsot-seating' ),
				'edit' => __( 'edit', 'qsot-seating' ),
				'struct_msg' => __( 'The pricing strctures created in this box are selectable on a per event basis, in the "new event" pages. Also, the prices set in this box apply to the entire seating chart, unless you have specifically set a different price for specific seats or zones.', 'qsot-seating' ),
				'customize' => __( 'Customize Pricing', 'qsot-seating' ),
				'sure' => __( 'Are you sure you want to customize the pricing for these zones?', 'qsot-seating' ),
				'yes' => __( 'Yes', 'qsot-seating' ),
				'zones' => __( 'Selected Zones', 'qsot-seating' ),
				'customize_msg' => __( 'Changes in this box apply to only the zones listed above. All other zones will either use the entire seating chart settings, or any custom settings you have already set for them.', 'qsot-seating' ),
				'empty' => __( '(empty-name)', 'qsot-seating' ),
				'customize' => __( 'customize pricing', 'qsot-seating' ),
			),
		) );
		// add our styling for the chosen plugin (will eventually be replaced by select2)
		wp_enqueue_style( 'qsot-chosen' );
	}

	// add the logic to handle the seating pricing setting in the event settings box
	public static function admin_event_assets( $exists, $venue_id ) {
		wp_enqueue_script( 'qsot-seating-event-settings' );
	}

	// add the seating chart pricing param to the event settings box
	public static function event_settings_ui() {
		add_action( 'qsot-events-bulk-edit-settings', array( __CLASS__, 'bulk_settings_pricing' ), 50, 2 );
	}

	// actually draw the field for the pricing selection
	public static function bulk_settings_pricing( $post, $mb ) {
		$price_structures = apply_filters( 'qsot-get-price-structures', array(), array( 'with__prices' => false, 'event_area_id' => '*' ) );
		?>
			<div class="setting-group">
				<div class="setting" rel="setting-main" tag="price-struct">
					<div class="setting-current">
						<span class="setting-name"><?php _e( 'Pricing Structure:', 'qsot' ) ?></span>
						<span class="setting-current-value" rel="setting-display"></span>
						<a class="edit-btn" href="#" rel="setting-edit" scope="[rel=setting]" tar="[rel=form]"><?php _e( 'Edit', 'qsot' ) ?></a>
						<input type="hidden" name="settings[price-struct]" value="" scope="[rel=setting-main]" rel="price-struct" />
					</div>
					<div class="setting-edit-form" rel="setting-form">
						<select rel="pool" style="display:none;">
							<option value="0"><?php _e( '- None -', 'qsot' ) ?></option>
							<?php foreach ($price_structures as $struct): ?>
								<option value="<?php echo esc_attr( $struct->id ) ?>" event-area-id="<?php echo $struct->event_area_id ?>"><?php echo $struct->name ?></option>
							<?php endforeach; ?>
						</select>
						<select name="price-struct" rel="vis-list">
							<option value="0"><?php _e( '- None -', 'qsot' ) ?></option>
						</select>
						<div class="edit-setting-actions">
							<input type="button" class="button" rel="setting-save" value="<?php _e( 'OK', 'qsot' ) ?>" />
							<a href="#" rel="setting-cancel"><?php _e( 'Cancel', 'qsot' ) ?></a>
						</div>
					</div>
				</div>
			</div>
		<?php
	}

	// save action for a child event. sets up the pricing struct used by this event only
	public static function save_sub_event_settings( $settings, $parent_id, $parent ) {
		if ( isset( $settings['submitted'], $settings['submitted']->price_struct ) ) {
			$settings['meta'][ self::$o->{'seating.mk.struct'} ] = $settings['submitted']->price_struct;
		}

		return $settings;
	}

	// when loading a child event, load the pricing struct info also
	public static function load_child_event_settings( $settings, $defs, $event ) {
		if ( is_object( $event ) && isset( $event->ID ) ) {
			$settings['price-struct'] = get_post_meta( $event->ID, self::$o->{'seating.mk.struct'}, true );
		}

		return $settings;
	}

	// setup the metaboxes used by the seating chart ui
	public static function metaboxes( $post_type, $post ) {
		// remove the EA box on the venue pages
		remove_meta_box( 'available-event-areas', 'qsot-venue', 'normal' );

		// add the venue selection to the seating chart ui pages
		add_meta_box(
			'qsot-seating-chart-venue',
			'Venue',
			array( __CLASS__, 'mb_venue' ),
			'qsot-event-area',
			'side',
			'high'
		);

		// the primary container for the seating chart UI
		add_meta_box(
			'qsot-seating-chart',
			'Seating Chart',
			array( __CLASS__, 'mb_seating_ui' ),
			'qsot-event-area',
			'normal',
			'high'
		);

		// container to handle the pricing assignments
		add_meta_box(
			'price-structures',
			'Price Structures',
			array( __CLASS__, 'mb_price_structs' ),
			'qsot-event-area',
			'side',
			'core'
		);
	}

	// draw the box that allows selection of the venue this seating chart belongs to
	public static function mb_venue( $post, $mb ) {
		$venues = get_posts( array(
			'post_type' => 'qsot-venue',
			'post_status' => 'any',
			'posts_per_page' => -1,
		) );

		$current = $post->post_parent;

		?>
			<select name="post_parent" class="widefat">
				<option value="">-- Select Venue --</option>
				<?php foreach ( $venues as $venue ): ?>
					<option <?php selected( $venue->ID, $current ) ?> value="<?php echo esc_attr( $venue->ID ) ?>"><?php echo apply_filters( 'the_title', $venue->post_title ) ?></option>
				<?php endforeach; ?>
			</select>
		<?php
	}

	// draw the base box that holds the seating chart ui, and a default message for those who do not meet the requirements
	public static function mb_seating_ui( $post, $mb ) {
		?><div class="qsot qsot-seating-chart-ui" rel="qsot-scui"><div class="qsot-misfea"><em><strong><?php
			_e( 'The seating chart creation & editing tool requires a Javascript and SVG enabled browser. You are missing one or more of these features.', 'qsot' )
		?></strong></em></div></div>
		<script language="javascript">
			jQuery( function( $ ) {
				console.log( 'debug', QS );
				QS.SC = new QS.SeatingUI( { container:'[rel="qsot-scui"]' } );
			} );
		</script>
		<?php
	}

	// accept a list of zones (usually from a save action), a list of existing zones, and a map of names to zones. from that generate an organized, normalized list of zones. this new list can contain
	// updates to existing zones, the creation of new zones, or the deletion of existing zones, where applicable.
	protected static function _merge_input_data( $input, $zones, $existing_zone_map ) {
		// number used to create unique faux ids on new zones that do not already have one
		static $ind = -1;
		$touched = array();

		// cycle through each input zone
		foreach ( $input as $zone ) {
			// if the zone has an id already, adn that id exists in our list of existing zone ids, then
			if ( isset( $zone[ 'zone_id' ] ) && isset( $zones[ $zone[ 'zone_id' ] ] ) ) {
				$zone_id = $zone['zone_id'];
				// track which zones we have updated from the existing zone list
				$touched[] = $zone_id;
				// copy the existing zone meta
				foreach ( $zones[ $zone_id ]->meta as $k => $v ) $zones[ $zone_id ]->meta[ $k ] = '';
				// overlay the new settings on top the old settings, for this record. create an 'update existing zone' record
				foreach ( $zone as $k => $v ) {
					$v = urldecode( $v );
					switch ( $k ) {
						case 'zone_id': break;
						case 'id': $zones[ $zone_id ]->abbr = trim( $v ); break;
						case 'zone': $zones[ $zone_id ]->name = trim( $v ); break;
						case 'capacity': $zones[ $zone_id ]->capacity = (int) $v; break;
						default: $zones[ $zone_id ]->meta[ $k ] = $v; break;
					}
				}
			// we must have at least an 'id' (different than zone_id) in order to save the zone information, because that is presumably the unique id used to identify a zone. without at least this, we are lost,
			// and cannot save any information for the zone. this may change later
			} else if ( isset( $zone['id'] ) ) {
				// if the zone was removed and then readded with the same 'id' (different than zone_id), thus losing it's zone_id, we can use the 'id' to lookup if it was previoously assigned a zone_id. if it was,
				// we can use that zone_id as a reference, and simply update that record
				if ( isset( $existing_zone_map[ $zone['id'] ] ) ) {
					$zone_id = $existing_zone_map[ $zone['id'] ];
					// track which zones we have updated from the existing zone list
					$touched[] = $zone_id;
					// copy the existing meta from the existing zone entry
					foreach ( $zones[ $zone_id ]->meta as $k => $v ) $zones[ $zone_id ]->meta[ $k ] = '';
					// overlay all the new data on top the old data
					foreach ( $zone as $k => $v ) {
						$v = urldecode( $v );
						switch ( $k ) {
							case 'zone_id': break;
							case 'id': $zones[ $zone_id ]->abbr = trim( $v ); break;
							case 'zone': $zones[ $zone_id ]->name = trim( $v ); break;
							case 'capacity': $zones[ $zone_id ]->capacity = (int) $v; break;
							default: $zones[ $zone_id ]->meta[ $k ] = $v; break;
						}
					}
				// otherwise we will need to create a 'new zone record' which will add a zone to the seating chart
				} else {
					// create the base default zone information
					$new_zone = (object)array( 'abbr' => '', 'name' => '', 'capacity' => 0, 'meta' => array() );
					// overlay any new settings on top of those defaults
					foreach ( $zone as $k => $v ) {
						$v = urldecode( $v );
						switch ( $k ) {
							case 'id': $new_zone->abbr = trim( $v ); break;
							case 'zone': $new_zone->name = trim( $v ); break;
							case 'capacity': $new_zone->capacity = (int) $v; break;
							default: $new_zone->meta[ $k ] = $v; break;
						}
					}

					// if there is in fact an 'id' present, then
					if ( strlen( $new_zone->abbr ) > 0 ) {
						// normalize the display name
						if ( ! isset( $new_zone->name ) ) $new_zone->name = str_replace( '-', ' ', $new_zone->abbr );
						// assign it a faux zone_id and add it to the list
						$zones[ ( $ind-- ) . '' ] = $new_zone;
					}
				}
			}
		}

		// mark any previously existing zones that did not receive an update above as needing deletion
		$untouched = array_diff( array_keys( $zones ), $touched );
		foreach ( $untouched as $zone_id ) if ( $zone_id > 0 ) $zones[ $zone_id . '' ]->_delete = 1;

		return $zones;
	}

	// draw the box to control the pricing structures of this seating chart
	public static function mb_price_structs( $post, $mb ) {
		?>
			<div class="show-if-js qsot">
				<div class="pricing-ui" rel="price-ui"></div>
			</div>

			<div class="hide-if-js">
				<p><?php echo __( 'The Price Structure UI requires javascript. Enable it, or this feature will not be editable in your current browser.', 'qsot-seating' ) ?></p>
			</div>
		<?php
	}

	protected static function _consolidate_pricing( $base, &$zones, $new_zone_map ) {
		$out = $base;

		// convert all zone pricing to objects
		foreach ( $zones as &$zone ) {
			if ( ! isset( $zone->meta, $zone->meta['pricing'] ) ) continue;
			$zone->meta['pricing'] = maybe_json_decode( $zone->meta['pricing'] );
		}

		// merge the zone pricing with the base pricing table, in the format that the update function expects
		foreach ( $out as $struct_id => &$struct ) {
			if ( ! isset( $struct['prices'][0] ) || ! is_array( $struct['prices'][0] ) ) {
				$struct['prices'] = array( '0' => $struct['prices'] );
			}
			foreach ( $zones as $zone_id => &$zone ) {
				if ( ! isset( $zone->meta, $zone->meta['pricing'] ) ) continue;

				$pricing = $zone->meta['pricing'];

				$z_id = $zone_id > 0 ? $zone_id : ( isset( $new_zone_map[ $zone_id ] ) ? $new_zone_map[ $zone_id ] : false );
				if ( ! $z_id ) continue;

				if ( isset( $pricing->{ $struct_id . '' } ) )
					$struct['prices'][ $z_id . '' ] = $pricing->{ $struct_id . '' };
			}
		}

		// remove all zone pricing from the zone meta, since it is merged with the base pricing now
		foreach ( $zones as &$zone ) {
			if ( ! isset( $zone->meta, $zone->meta['pricing'] ) ) continue;
			unset( $zone->meta['pricing'] );
		}

		return $out;
	}

	// deteerming the first price in the price list, so that we can set something as the core pricing option for the event area. this will be used by all the core OTCE code when loading the event area
	protected static function _first_price( $list ) {
		$found = 0;
		if ( is_array( $list ) ) foreach ( $list as $sub_list ) {
			if ( isset( $sub_list['prices'], $sub_list['prices'][0] ) && is_array( $sub_list['prices'][0] ) ) foreach ( $sub_list['prices'][0] as $id ) {
				if ( $id > 0 ) {
					$found = $id;
					break 2;
				}
			}
		}

		return $found;
	}

	// when saving the seating charts, run our save parser to interpret the save request
	public static function save_post( $post_id, $post, $update=false ) {
		// make sure that this is actually a user activated save, not a system generated one. and make sure that our needed data is present
		if ( ! isset( $_POST['qsot-seating-ui'] ) ) return;

		// load the current values for zones and zoom zones
		$zones = apply_filters( 'qsot-get-seating-zones', array(), $post_id, 1 );
		$zzones = apply_filters( 'qsot-get-seating-zones', array(), $post_id, 2 );

		// create a zone-name ot zone-id map for lookups that are not id based. for instance if a zone was accidentally deleted and then recreated in the same page load
		$existing_zone_map = $existing_zzone_map = array();
		$total_capacity = 0;
		foreach ( $zones as $zone ) {
			$existing_zone_map[ $zone->abbr ] = $zone->id;
			// also tally the total capacity
			$total_capacity += $zone->capacity;
		}
		foreach ( $zzones as $zone ) $existing_zzone_map[ $zone->abbr ] = $zone->id;

		// grab and interpret the sent data
		$raw_settings = @json_decode( stripslashes( $_POST['qsot-seating-settings'] ), true );
		$raw_zones = @json_decode( stripslashes( $_POST['qsot-seating-zones'] ), true );
		$raw_zzones = @json_decode( stripslashes( $_POST['qsot-seating-zoom-zones'] ), true );

		// create a list of zone updates. can be inserts, updates or deletes
		$zones = self::_merge_input_data( $raw_zones, $zones, $existing_zone_map );
		$zzones = self::_merge_input_data( $raw_zzones, $zzones, $existing_zzone_map );
		
		// actaully perform the zone updates. returns a map of 'new item ids' to their actual new id, like: -1 => 1234; where -1 is the faux id from the frontend, and 1234 is the actual zone id
		$new_zone_map = apply_filters( 'qsot-update-seating-zones', false, $zones, $post_id, 1 );
		$new_zzone_map = apply_filters( 'qsot-update-seating-zones', false, $zzones, $post_id, 2 );

		// create the updated the pricing tables based on the supplied price structs and the interpreted zone specific pricing supplied
		$pricing = self::_consolidate_pricing( $raw_settings['pricing'], $zones, $new_zone_map );

		// update the total capacity and 'base price' for otce compatibility
		update_post_meta( $post_id, self::$o->{'event_area.mk.cap'}, $total_capacity );
		update_post_meta( $post_id, self::$o->{'event_area.mk.po'}, self::_first_price( $pricing ) );

		// actually update the pricing tables
		do_action( 'qsot-update-seating-pricing', $pricing, $post_id );

		// tell every one of the update
		do_action( 'qsot-saved-seating', $post_id, $zones, $zzones, $new_zone_map, $new_zzone_map, $pricing );
	}
}

if ( defined( 'ABSPATH' ) & function_exists( 'add_action' ) ) QSOT_seating_admin::pre_init();
