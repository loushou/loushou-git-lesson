<?php (__FILE__ == $_SERVER['SCRIPT_FILENAME']) ? die(header('Location: /')) : null;
/**
 * Plugin Name: OpenTickets - Seating
 * Plugin URI:  http://opentickets.com/
 * Description: Provides a graphical interface for creating and displaying an interactive seating chart.
 * Version:     1.0.18
 * Author:      Quadshot Software LLC
 * Author URI:  http://quadshot.com/
 * Text Domain: qsot-seating
 * Domain Path: /langs/
 * Copyright:   Copyright (C) 2009-2014 Quadshot Software LLC
 * License:     OpenTickets Software License Agreement
 * License URI: http://opentickets.com/opentickets-software-license-agreement
 */

// checks all seating plugin dependencies and sets up the plugin in general
class QSOT_seating_launcher {
	// urls to relevant quadshot products
	protected static $urls = array(
		'me' => 'http://opentickets.com/product/opentickets-seating/',
		'opentickets' => 'https://wordpress.org/plugins/opentickets-community-edition/',
	);
	// plugin basename
	protected static $me = '';
	// plugin version
	protected static $version = '1.0.18';
	protected static $version_key = 'qsot_seating_version';
	// plugin paths
	protected static $plugin_url = '';
	protected static $plugin_dir = '';

	// dependency check vars. 
	// list of plugins currently in conflict with this one
	protected static $in_conflict = array();
	// min versions of required softwares
	protected static $min_wc_version = '2.3.8';
	protected static $min_otce_version = '1.10.21';

	// setup the plugin
	public static function pre_init() {
		// fill plugin vars
		self::$me = plugin_basename(__FILE__);
		self::$plugin_url = plugin_dir_url(__FILE__);
		self::$plugin_dir = plugin_dir_path(__FILE__);

		if ( self::_pass_system_requirements() ) {
			// add our class dirs to OTCE load
			add_filter( 'qsot-load-includes-dirs', array( __CLASS__, 'inform_core_about_us' ), 10 );
			// add template dirs to OTCE templater
			add_filter( 'qsot-template-dirs', array( __CLASS__, 'add_template_directory' ), 10000, 4 );
			// do load finalization after all plugins have loaded
			add_action( 'plugins_loaded', array( __CLASS__, 'plugins_loaded' ) );

			if ( is_admin() )
				self::_check_version();

			// register our own activation function
			register_activation_hook( __FILE__, array( __CLASS__, 'activation' ) );
		}

		load_plugin_textdomain( 'qsot-seating', false, dirname( self::$me ) . '/langs/' );
	}

	public static function me() { return self::$me; }
	public static function version() { return self::$version; }
	public static function plugin_url() { return self::$plugin_url; }
	public static function plugin_dir() { return self::$plugin_dir; }

	// check and possibly update the version number. this is mainly done for the benefit of other plugins, since this is not used anywhere in our code
	protected static function _check_version() {
		$version = get_option( self::$version_key, '0.0.0' );
		if ( $version != self::$version )
			update_option( self::$version_key, self::$version );
	}

	// perform various dep chacks
	protected static function _pass_system_requirements() {
		$pass = true;

		// require OTCE plugin
		if ( ! self::_is_opentickets_active() ) {
			add_action( 'admin_notices', array( __CLASS__, 'error_requires_opentickets' ) );
			// when opentickets community edition is activated, run our activation as well
			$file = substr( self::$me, 0, strpos( self::$me, 'qsot-seating' ) ) . implode( DIRECTORY_SEPARATOR, array( 'opentickets-community-edition', 'launcher.php' ) );
			add_action( 'activate_' . $file, array( __CLASS__, 'activation' ), 1000000 );
			$pass = false;
		// require min OTCE version
		} else if ( ! self::_is_opentickets_min_version() ) {
			add_action( 'admin_notices', array( __CLASS__, 'error_opentickets_min_version' ) );
			$pass = false;
		}

		// require WC plugin
		if ( ! self::_is_woocommerce_active() ) {
			add_action( 'admin_notices', array( __CLASS__, 'error_requires_woocommerce' ) );
			// when woocommerce is activated, run our activation as well
			$file = substr( self::$me, 0, strpos( self::$me, 'qsot-seating' ) ) . implode( DIRECTORY_SEPARATOR, array( 'woocommerce', 'woocommerce.php' ) );
			add_action( 'activate_' . $file, array( __CLASS__, 'activation' ), 1000000 );
			$pass = false;
		// require min WC version
		} else if ( ! self::_is_woocommerce_min_version() ) {
			add_action( 'admin_notices', array( __CLASS__, 'error_woocommerce_min_version' ) );
			$pass = false;
		}
		
		// check for known conflicting plugins
		if ( self::_has_conflicting_plugins() ) {
			add_action( 'admin_notices', array( __CLASS__, 'error_conflicting_plugins_active' ) );
			$pass = false;
		}

		return $pass;
	}

	public static function inform_core_about_us($plugin_directories) {
		array_unshift( $plugin_directories, trailingslashit( dirname( __FILE__ ) ) . 'seating/' );
		return array_unique($plugin_directories);
	}

	public static function add_template_directory($list, $qsot_path='', $woo_path='', $type=false) {
		if ($qsot_path == 'templates/admin/') array_unshift($list, plugin_dir_path(__FILE__).'templates/admin/');
		else if ($type == 'woocommerce') array_unshift($list, plugin_dir_path(__FILE__).'templates/woocommerce/');
		else array_unshift($list, plugin_dir_path(__FILE__).'templates/');
		return $list;
	}

	protected static function _error_dep_min_version( $dep, $min_version, $cur_version ) {
		?>
			<div class="error errors">
				<p class="error"><?php echo sprintf(
					__( '<u><strong>%s</strong></u><br/> The %s plugin <strong>requires</strong> that %s be at least at version %s. You currently have version %s. Please upgrade %s to finish activating all functionality of the %s plugin.', 'qsot-seating' ),
					self::_me_link(),
					self::_me_link(),
					$dep,
					$min_version,
					$cur_version,
					$dep,
					self::_me_link()
				) ?>
				</p>
			</div>
		<?php
	}

	public static function error_opentickets_min_version() {
		self::_error_dep_min_version( self::_me_link( self::$urls['opentickets'], 'OpenTickets Community Edition' ), self::$min_otce_version, get_option( 'opentickets_community_edition_version', '0.0.0' ) );
	}

	public static function error_woocommerce_min_version() {
		self::_error_dep_min_version( self::_me_link( null, 'WooCommerce' ), self::$min_wc_version, get_option( 'woocommerce_version', '0.0.0' ) );
	}

	protected static function _requires_plugin( $req_plugin ) {
		?>
			<div class="error errors">
				<p class="error"><?php echo sprintf(
					__( '<u><strong>%s</strong></u><br/> The %s plugin <strong>requires</strong> that %s be activated in order to perform most vital functions; therefore, the plugin has not initialized any of its functionality. To enable the features of this plugin, simply install and activate %s.', 'qsot-seating' ),
					self::_me_link(),
					self::_me_link(),
					$req_plugin,
					$req_plugin
				) ?>
				</p>
			</div>
		<?php
	}

	public static function error_requires_opentickets() {
		self::_requires_plugin( self::_me_link( self::$urls['opentickets'], 'OpenTickets Community Edition' ) );
	}

	public static function error_requires_woocommerce() {
		self::_requires_plugin( self::_me_link( null, 'WooCommerce' ) );
	}

	public static function error_conflicting_plugins_active() {
		?>
			<div class="error errors">
				<p class="error"><?php echo sprintf(
					__( 'There are one or more plugins active that have know conflicts with %s. Please deactivate the following plugins, in order to ensure that the %s plugin functions properly: <strong><em>%s</em></strong>', 'qsot-seating' ),
					self::_me_link(),
					self::_me_link(),
					implode( ', ', self::$in_conflict )
				) ?>
				</p>
			</div>
		<?php
	}

	// determine if a given plugin is active
	public static function _is_plugin_active( $plugin_dir, $plugin_file ) {
		static $active = false;
		if ( false == $active ) {
			// aggregate a complete list of active plugins, including those that could be active on the network level
			$active = get_option( 'active_plugins', array() );
			$network = defined( 'MULTISITE' ) && MULTISITE ? get_site_option( 'active_sitewide_plugins' ) : array();
			$active = is_array( $active ) ? $active : array();
			$network = is_array( $network ) ? $network : array();
			$active = array_merge( array_keys( $network ), $active );
		}

		// check if the regular plugin is active
		$is_active = in_array( $plugin_dir . DIRECTORY_SEPARATOR . $plugin_file, $active );

		// if the regular plugin is not acitve, check for known direcotry formats for github zip downloads
		if ( ! $is_active ) {
			foreach ( $active as $active_plugin ) {
				if ( preg_match( '#^' . preg_quote( $plugin_dir, '#' ) . '-(master|[\d\.]+(-(alpha|beta|RC\d+)(-\d+)?)?)[\/\\\\]' . preg_quote( $plugin_file, '#' ). '$#', $active_plugin ) ) {
					$is_active = true;
					break;
				}
			}
		}

		return $is_active;
	}

	// check if OTCE is active
	public static function _is_opentickets_active() {
		return self::_is_plugin_active( 'opentickets-community-edition', 'launcher.php' );
	}

	// check if WooCommerce is active
	public static function _is_woocommerce_active() {
		return self::_is_plugin_active( 'woocommerce', 'woocommerce.php' );
	}

	public static function _is_woocommerce_min_version() {
		return version_compare( get_option( 'woocommerce_version', '0.0.0' ), self::$min_wc_version ) >= 0;
	}

	public static function _is_opentickets_min_version() {
		return version_compare( get_option( 'opentickets_community_edition_version', '0.0.0' ), self::$min_otce_version ) >= 0;
	}

	public static function _has_conflicting_plugins() {
		$conflicts = array(
			'qsot-ga-multi-price/qsot-ga-multi-price.php' => __( 'OpenTickets General Admission Multiprice', 'qsot-seating' ),
		);

		$active = get_option('active_plugins');
		foreach ( $conflicts as $file => $name ) {
			if ( in_array( $file, $active ) ) {
				self::$in_conflict[ $file ] = $name;
			}
		}

		return !! count( self::$in_conflict );
	}

	protected static function _me_link($link='', $label='', $format='') {
		$link = '' === $link ? $link : self::$urls['me'];
		$label = $label ? $label : 'OpenTickets - Seating';
		$format = $format ? $format : ( null !== $link ? '<em><a href="%1$s" target="_blank">%2$s</a></em>' : '<em>%2$s</em>' );

		return sprintf($format, esc_attr($link), $label);
	}

	public static function plugins_loaded() {
		do_action('qsot-register-addon', self::$me, array('code' => 'ZrfX7Xu#5D5eh=zY9tBtHbu^I8NO.@SXCxsm]dG|gDV<aRtt9]Oz*mKRxjt*wv2R', 'product' => 'QSOTSeating'));
	}

	public static function activation() {
		self::plugins_loaded();
		//QSOT_addon_registry::instance()->force_check();

		$path = QSOT_seating_launcher::plugin_dir() . 'seating/';
		require_once $path . 'core.class.php';
		//require_once $path . 'core/zoner.class.php';

		do_action('qsot-seating-activation');
	}
}

if (defined('ABSPATH') && function_exists('add_action')) {
	QSOT_seating_launcher::pre_init();
}
