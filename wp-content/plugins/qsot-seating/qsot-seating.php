<?php (__FILE__ == $_SERVER['SCRIPT_FILENAME']) ? die(header('Location: /')) : null;
/**
 * Plugin Name: OpenTickets - Seating
 * Plugin URI:  http://opentickets.com/
 * Description: Provides a graphical interface for creating and displaying an interactive seating chart.
 * Version:     1.0.7
 * Author:      Quadshot Software LLC
 * Author URI:  http://quadshot.com/
 * Copyright:   Copyright (C) 2009-2014 Quadshot Software LLC
 * License:     OpenTickets Software License Agreement
 * License URI: http://opentickets.com/opentickets-software-license-agreement
 */

class QSOT_seating_launcher {
	protected static $urls = array(
		'me' => 'http://opentickets.com/',
		'opentickets' => 'https://wordpress.org/plugins/opentickets-community-edition/',
	);
	protected static $me = '';
	protected static $version = '1.0.7';
	protected static $plugin_url = '';
	protected static $plugin_dir = '';

	public static function pre_init() {
		self::$me = plugin_basename(__FILE__);
		self::$plugin_url = plugin_dir_url(__FILE__);
		self::$plugin_dir = plugin_dir_path(__FILE__);

		if (self::_is_opentickets_active()) {
			add_filter('qsot-load-includes-dirs', array(__CLASS__, 'inform_core_about_us'), 10);
			add_filter('qsot-template-dirs', array(__CLASS__, 'add_template_directory'), 10000, 4);
			add_action('plugins_loaded', array(__CLASS__, 'plugins_loaded'));

			add_filter('qsot-woocommerce-class-paths', array(__CLASS__, 'woocommerce_class_paths'), 100000, 3);
			add_filter('qsot-woocommerce-meta-box-paths', array(__CLASS__, 'woocommerce_meta_box_paths'), 100000, 3);

			register_activation_hook(__FILE__, array(__CLASS__, 'activation'));
			if ( isset( $_GET['debug_activate'] ) && $_GET['debug_activate'] ) add_action('init', function() { QSOT_seating_launcher::activation(); }, PHP_INT_MAX );
		} else {
			add_action('admin_notices', array(__CLASS__, 'requires_opentickets'));
		}
	}

	public static function me() { return self::$me; }
	public static function version() { return self::$version; }
	public static function plugin_url() { return self::$plugin_url; }
	public static function plugin_dir() { return self::$plugin_dir; }

	public static function woocommerce_class_paths($paths, $orig_paths, $class) {
		array_unshift($paths, self::plugin_dir().'woocommerce/includes/');
		return $paths;
	}

	public static function woocommerce_meta_box_paths($paths, $orig_paths, $class) {
		array_unshift($paths, self::plugin_dir().'woocommerce/includes/admin/post-types/meta-boxes/');
		return $paths;
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

	public static function requires_opentickets() {
		?>
			<div class="error errors">
				<p class="error"><?php echo sprintf(
					__( '<u><strong>%s</strong></u><br/> The %s plugin <strong>requires</strong> that %s be activated in order to perform most vital functions; therefore, the plugin has not initialized any of its functionality. To enable the features of this plugin, simply install and activate %s.', 'qsot' ),
					self::_me_link(),
					self::_me_link(self::$urls['opentickets'], 'OpenTickets Community Edition'),
					self::_me_link(self::$urls['opentickets'], 'OpenTickets Community Edition'),
					self::_me_link(self::$urls['opentickets'], 'OpenTickets Community Edition')
				) ?>
				</p>
			</div>
		<?php
	}

	public static function _is_opentickets_active() {
		$active = get_option('active_plugins');
		$is_active = in_array('opentickets-community-edition/launcher.php', $active);
		return $is_active;
	}

	protected static function _me_link($link='', $label='', $format='') {
		$link = $link ? $link : self::$urls['me'];
		$label = $label ? $label : 'OpenTickets - Seating';
		$format = $format ? $format : '<em><a href="%s" target="_blank">%s</a></em>';

		return sprintf($format, esc_attr($link), $label);
	}

	public static function plugins_loaded() {
		do_action('qsot-register-addon', self::$me, array('code' => 'ZrfX7Xu#5D5eh=zY9tBtHbu^I8NO.@SXCxsm]dG|gDV<aRtt9]Oz*mKRxjt*wv2R', 'product' => 'QSOTSeating'));
	}

	public static function activation() {
		self::plugins_loaded();
		//QSOT_addon_registry::instance()->force_check();

		$path = QSOT_seating_launcher::plugin_dir() . 'seating/';
		include $path . 'core.class.php';
		include $path . 'zoner.class.php';

		do_action('qsot-seating-activation');
	}
}

if (defined('ABSPATH') && function_exists('add_action')) {
	QSOT_seating_launcher::pre_init();
}
