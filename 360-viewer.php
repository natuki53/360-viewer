<?php
/**
 * Plugin Name: 360° Viewer
 * Description: Add a 360° photo viewer block using Three.js.
 * Version: 1.0.2
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
    $image_url = isset($attributes['imageUrl']) ? esc_url($attributes['imageUrl']) : '';
    
    if (empty($image_url)) {
        return '<div class="psv-container psv-no-image"><p>360°画像が設定されていません。</p></div>';
    }
    
    return '<div class="psv-container" data-img="' . $image_url . '"></div>';
}

function viewer360_enqueue_scripts() {
    // Three.jsを常に読み込み
    wp_enqueue_script(
        'three-js',
        plugins_url('src/assets/three.min.js', __FILE__),
        array(),
        '0.160.0',
        true
    );
    
    // フロントエンド用のビューアスクリプトの読み込み
    if (file_exists(__DIR__ . '/build/viewer.js')) {
        // ビルド済みのスクリプトを使用
        wp_enqueue_script(
            'viewer360-script',
            plugins_url('build/viewer.js', __FILE__),
            array('three-js'),
            '1.0.2',
            true
        );
    } else {
        // 開発環境用：直接ソースファイルを読み込む
        wp_enqueue_script(
            'viewer360-script',
            plugins_url('src/blocks/360viewer/viewer.js', __FILE__),
            array('three-js'),
            '1.0.2',
            true
        );
    }

    // ビルド済みのスタイルの読み込み（ビルドプロセスで生成）
    if (file_exists(__DIR__ . '/build/style-index.css')) {
        wp_enqueue_style(
            'viewer360-style',
            plugins_url('build/style-index.css', __FILE__),
            array(),
            '1.0.2'
        );
    } else {
        // ビルドされていない場合はソースのスタイルシートを使用
        wp_enqueue_style(
            'viewer360-style',
            plugins_url('src/blocks/360viewer/style.scss', __FILE__),
            array(),
            '1.0.2'
        );
    }

    // 設定を追加
    wp_localize_script(
        'viewer360-script',
        'PSV360Config',
        array(
            'disableResponsiveImages' => true,
            'version' => '1.0.2',
        )
    );
}
add_action('wp_enqueue_scripts', 'viewer360_enqueue_scripts'); 