<?php
/**
 * Plugin Name: 360° Viewer
 * Description: Add a 360° photo viewer block using Three.js.
 * Version: 1.1.0
 * Author: natuki
 */

function viewer360_register_block() {
    // ビルド済みのblock.jsonがある場合はそれを使用
    if (file_exists(__DIR__ . '/build/blocks/360viewer/block.json')) {
        register_block_type( __DIR__ . '/build/blocks/360viewer/block.json', array(
            'render_callback' => 'viewer360_render_block'
        ));
    } else {
        // ない場合はソースを使用
        register_block_type( __DIR__ . '/src/blocks/360viewer/block.json', array(
            'render_callback' => 'viewer360_render_block'
        ));
    }
}
add_action( 'init', 'viewer360_register_block' );

function viewer360_render_block($attributes) {
    $image_id          = isset($attributes['imageId'])          ? absint($attributes['imageId'])              : 0;
    $image_url         = '';
    $aspect_ratio      = isset($attributes['aspectRatio'])      ? $attributes['aspectRatio']                  : '16/9';
    $auto_rotate       = isset($attributes['autoRotate'])       ? (bool) $attributes['autoRotate']            : true;
    $auto_rotate_speed = isset($attributes['autoRotateSpeed'])  ? floatval($attributes['autoRotateSpeed'])    : 3;
    $initial_longitude = isset($attributes['initialLongitude']) ? floatval($attributes['initialLongitude'])   : 90;

    // aspectRatio のサニタイズ（"数字/数字" 形式のみ許可）
    if ( ! preg_match( '/^\d+(\.\d+)?\/\d+(\.\d+)?$/', $aspect_ratio ) ) {
        $aspect_ratio = '16/9';
    }

    // imageId がある場合は常に現在の添付URLを優先して使う
    if ($image_id > 0) {
        $resolved_image_url = wp_get_attachment_image_url($image_id, 'full');
        if (!empty($resolved_image_url)) {
            $image_url = $resolved_image_url;
        }
    }

    // imageId から解決できなかった場合のみ、保存済みURLをフォールバックとして使う
    if (empty($image_url) && !empty($attributes['imageUrl'])) {
        $image_url = $attributes['imageUrl'];
    }

    // HTTPSページで同一サイトURLが http の場合は https に統一（混在コンテンツ対策）
    if (!empty($image_url) && is_ssl() && 0 === strpos($image_url, 'http://')) {
        $image_url = set_url_scheme($image_url, 'https');
    }

    // esc_url() で安全なURL文字列に変換（HTML属性への出力は esc_url() のみで十分）
    $image_url = esc_url($image_url);

    if (empty($image_url)) {
        return '<div class="psv-container psv-no-image"><p>360°画像が設定されていません。</p></div>';
    }

    viewer360_enqueue_assets();

    $data_attrs = sprintf(
        ' data-img="%s" data-aspect-ratio="%s" data-auto-rotate="%s" data-auto-rotate-speed="%s" data-initial-longitude="%s"',
        $image_url,
        esc_attr($aspect_ratio),
        $auto_rotate ? 'true' : 'false',
        esc_attr($auto_rotate_speed),
        esc_attr($initial_longitude)
    );

    $inline_style = 'aspect-ratio: ' . esc_attr($aspect_ratio) . ';';

    return '<div class="psv-container" style="' . $inline_style . '"' . $data_attrs . '></div>';
}

function viewer360_get_asset_version($relative_path) {
    $absolute_path = __DIR__ . '/' . ltrim($relative_path, '/');
    if (file_exists($absolute_path)) {
        return (string) filemtime($absolute_path);
    }

    return '1.1.0';
}

function viewer360_enqueue_assets() {
    static $enqueued = false;
    if ($enqueued) {
        return;
    }
    $enqueued = true;

    // three.min.js はビルド時に build/ へコピーされる（webpack CopyPlugin）
    $three_script_path  = 'build/three.min.js';
    $viewer_script_path = 'build/viewer.js';
    $style_path         = 'build/style-index.css';

    if (!file_exists(__DIR__ . '/' . $viewer_script_path)) {
        return;
    }

    wp_enqueue_script(
        'three-js',
        plugins_url($three_script_path, __FILE__),
        array(),
        viewer360_get_asset_version($three_script_path),
        true
    );

    wp_enqueue_script(
        'viewer360-script',
        plugins_url($viewer_script_path, __FILE__),
        array('three-js'),
        viewer360_get_asset_version($viewer_script_path),
        true
    );

    if (file_exists(__DIR__ . '/' . $style_path)) {
        wp_enqueue_style(
            'viewer360-style',
            plugins_url($style_path, __FILE__),
            array(),
            viewer360_get_asset_version($style_path)
        );
    }

    wp_localize_script(
        'viewer360-script',
        'PSV360Config',
        array(
            'disableResponsiveImages' => true,
            'version' => '1.1.0',
            'debug' => defined('WP_DEBUG') && WP_DEBUG,
        )
    );
}
