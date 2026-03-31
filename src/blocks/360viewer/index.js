import './editor.css';
import './style.scss';
import { registerBlockType } from '@wordpress/blocks';
import {
	MediaPlaceholder,
	BlockControls,
	InspectorControls,
	useBlockProps,
} from '@wordpress/block-editor';
import {
	Button,
	ToolbarGroup,
	ToolbarButton,
	PanelBody,
	RangeControl,
	ToggleControl,
	__experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const Edit = ( props ) => {
	const { attributes, setAttributes } = props;
	const {
		imageUrl,
		imageId,
		height,
		autoRotate,
		autoRotateSpeed,
		initialLongitude,
	} = attributes;

	const blockProps = useBlockProps( {
		className: 'wp-block-psv360-viewer',
	} );

	const onSelectImage = ( media ) => {
		setAttributes( {
			imageUrl: media.url,
			imageId: media.id,
		} );
	};

	const onRemoveImage = () => {
		setAttributes( { imageUrl: '', imageId: undefined } );
	};

	return (
		<div { ...blockProps }>
			{ /* ツールバー */ }
			<BlockControls>
				{ imageUrl && (
					<ToolbarGroup>
						<ToolbarButton
							onClick={ onRemoveImage }
							icon="trash"
							label={ __( '写真を削除' ) }
						/>
					</ToolbarGroup>
				) }
			</BlockControls>

			{ /* サイドバー設定パネル */ }
			<InspectorControls>
				<PanelBody title={ __( '表示設定' ) } initialOpen={ true }>
					<RangeControl
						label={ __( '高さ (px)' ) }
						value={ height }
						onChange={ ( value ) =>
							setAttributes( { height: value } )
						}
						min={ 200 }
						max={ 900 }
						step={ 10 }
					/>
				</PanelBody>
				<PanelBody title={ __( '自動回転' ) } initialOpen={ true }>
					<ToggleControl
						label={ __( '自動回転を有効にする' ) }
						checked={ autoRotate }
						onChange={ ( value ) =>
							setAttributes( { autoRotate: value } )
						}
					/>
					{ autoRotate && (
						<RangeControl
							label={ __( '回転速度' ) }
							value={ autoRotateSpeed }
							onChange={ ( value ) =>
								setAttributes( { autoRotateSpeed: value } )
							}
							min={ 1 }
							max={ 10 }
							step={ 0.5 }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( '初期視点' ) } initialOpen={ false }>
					<NumberControl
						label={ __( '初期水平角度 (0〜360°)' ) }
						value={ initialLongitude }
						onChange={ ( value ) =>
							setAttributes( {
								initialLongitude: Number( value ),
							} )
						}
						min={ 0 }
						max={ 360 }
						step={ 1 }
					/>
				</PanelBody>
			</InspectorControls>

			{ /* メインエリア */ }
			<div className="psv-block-editor">
				{ ! imageUrl ? (
					<MediaPlaceholder
						icon="format-image"
						labels={ {
							title: __( '360°ビューア' ),
							instructions: __(
								'360°写真をアップロードするか、URLを入力してください'
							),
						} }
						onSelect={ onSelectImage }
						allowedTypes={ [ 'image' ] }
						accept="image/*"
					/>
				) : (
					<div
						className="psv-preview"
						style={ { height: `${ height }px` } }
					>
						{ /* 背景画像プレビュー */ }
						<img
							src={ imageUrl }
							alt="360°写真プレビュー"
							className="psv-preview__image"
						/>
						{ /* 360°オーバーレイ */ }
						<div className="psv-preview__overlay">
							<div className="psv-preview__badge">
								<span className="psv-preview__badge-icon">⟳</span>
								<span>360°</span>
							</div>
							<p className="psv-preview__hint">
								{ __(
									'フロントエンドでインタラクティブな360°ビューアとして表示されます'
								) }
							</p>
							<Button
								onClick={ onRemoveImage }
								variant="secondary"
								isDestructive
								size="small"
							>
								{ __( '写真を削除' ) }
							</Button>
						</div>
					</div>
				) }
			</div>
		</div>
	);
};

const save = () => {
	// サーバーサイドレンダリングを使用するためnullを返す
	return null;
};

registerBlockType( 'psv360/viewer', {
	edit: Edit,
	save,
} );
