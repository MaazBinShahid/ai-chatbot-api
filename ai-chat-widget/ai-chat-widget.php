<?php
/**
 * Plugin Name: AI Chat Widget
 * Description: Floating AI chat widget that connects to your FastAPI / OpenAI backend. Shortcode [ai_chat_widget] or auto-insert.
 * Version: 0.1
 * Author: You
 */

if (!defined('ABSPATH')) { exit; }

class AI_Chat_Widget {
    const OPTION_API = 'ai_chat_widget_api_url';
    const OPTION_AUTO = 'ai_chat_widget_auto_insert';

    public function __construct(){
        add_action('admin_menu', [$this,'admin_menu']);
        add_action('admin_init', [$this,'register_settings']);
        add_action('wp_enqueue_scripts', [$this,'enqueue_assets']);
        add_action('wp_footer', [$this,'maybe_insert_widget']);
        add_shortcode('ai_chat_widget', [$this,'render_shortcode']);
    }

    public function admin_menu(){
        add_options_page('AI Chat Widget', 'AI Chat Widget', 'manage_options', 'ai-chat-widget', [$this,'settings_page']);
    }

    public function register_settings(){
        register_setting('ai_chat_widget_group', self::OPTION_API, [
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => ''
        ]);
        register_setting('ai_chat_widget_group', self::OPTION_AUTO, [
            'type' => 'boolean',
            'sanitize_callback' => 'absint',
            'default' => 1
        ]);
    }

    public function settings_page(){
        if (!current_user_can('manage_options')) return;
        $api_url = get_option(self::OPTION_API, '');
        $auto = get_option(self::OPTION_AUTO, 1);
        ?>
        <div class="wrap">
          <h1>AI Chat Widget</h1>
          <form method="post" action="options.php">
            <?php settings_fields('ai_chat_widget_group'); do_settings_sections('ai_chat_widget_group'); ?>
            <table class="form-table">
              <tr>
                <th scope="row">Backend API URL</th>
                <td>
                  <input type="text" name="<?php echo esc_attr(self::OPTION_API); ?>" value="<?php echo esc_attr($api_url); ?>" style="width:100%" placeholder="https://abcd.ngrok-free.app/chat" />
                  <p class="description">Enter your ngrok or production API endpoint (must accept POST JSON { "query": "..." }).</p>
                </td>
              </tr>
              <tr>
                <th scope="row">Auto-insert widget</th>
                <td>
                  <input type="checkbox" name="<?php echo esc_attr(self::OPTION_AUTO); ?>" value="1" <?php checked(1, $auto); ?> /> Automatically add chat widget to site footer
                </td>
              </tr>
            </table>
            <?php submit_button(); ?>
          </form>
          <h2>Usage</h2>
          <p>Use <code>[ai_chat_widget]</code> to insert widget in a page, or enable auto-insert above.</p>
        </div>
        <?php
    }

    public function enqueue_assets(){
        wp_register_style('ai-chat-widget-css', plugins_url('assets/chat-widget.css', __FILE__));
        wp_register_script('ai-chat-widget-js', plugins_url('assets/chat-widget.js', __FILE__), [], null, true);
        wp_enqueue_style('ai-chat-widget-css');
        wp_enqueue_script('ai-chat-widget-js');

        $api_url = esc_url_raw(get_option(self::OPTION_API, ''));
        wp_localize_script('ai-chat-widget-js', 'aiChatSettings', [
            'apiUrl' => $api_url,
            'siteUrl' => get_site_url()
        ]);
    }

    public function maybe_insert_widget(){
        if (!get_option(self::OPTION_AUTO, 1)) return;
        echo '<div id="ai-chat-root"></div>';
    }

    public function render_shortcode($atts){
        return '<div id="ai-chat-root"></div>';
    }
}

new AI_Chat_Widget();
