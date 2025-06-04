import './editor.css';
import './style.scss';
import { registerBlockType } from '@wordpress/blocks';
import { MediaUpload, MediaUploadCheck, BlockControls, useBlockProps } from '@wordpress/block-editor';
import { Button, Placeholder, ToolbarGroup, ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

// ビューアーのJSは直接インポートせず、フロントエンドでのみ読み込む

registerBlockType('psv360/viewer', {
    edit: function(props) {
        const { attributes, setAttributes } = props;
        const { imageUrl } = attributes;
        
        const blockProps = useBlockProps({
            className: 'wp-block-psv360-viewer',
        });

        const onSelectImage = (media) => {
            setAttributes({
                imageUrl: media.url
            });
        };

        const onRemoveImage = () => {
            setAttributes({ imageUrl: '' });
        };

        return (
            <div {...blockProps}>
                <BlockControls>
                    <ToolbarGroup>
                        {imageUrl && (
                            <MediaUploadCheck>
                                <MediaUpload
                                    onSelect={onSelectImage}
                                    allowedTypes={['image']}
                                    value={imageUrl}
                                    render={({ open }) => (
                                        <ToolbarButton 
                                            onClick={open}
                                            icon="edit"
                                            label={__('写真を変更')}
                                        />
                                    )}
                                />
                            </MediaUploadCheck>
                        )}
                        {imageUrl && (
                            <ToolbarButton
                                onClick={onRemoveImage}
                                icon="trash"
                                label={__('写真を削除')}
                            />
                        )}
                    </ToolbarGroup>
                </BlockControls>
                <div className="psv-block-editor">
                    {!imageUrl ? (
                        <Placeholder
                            icon="format-image"
                            label={__('360°ビューア')}
                            instructions={__('360°写真をアップロードしてください')}
                        >
                            <MediaUploadCheck>
                                <MediaUpload
                                    onSelect={onSelectImage}
                                    allowedTypes={['image']}
                                    value={imageUrl}
                                    render={({ open }) => (
                                        <Button
                                            onClick={open}
                                            variant="primary"
                                        >
                                            {__('写真を選択')}
                                        </Button>
                                    )}
                                />
                            </MediaUploadCheck>
                        </Placeholder>
                    ) : (
                        <div className="psv-preview">
                            <img src={imageUrl} alt="360°写真プレビュー" style={{ maxWidth: '100%' }} />
                            <div className="psv-actions">
                                <MediaUploadCheck>
                                    <MediaUpload
                                        onSelect={onSelectImage}
                                        allowedTypes={['image']}
                                        value={imageUrl}
                                        render={({ open }) => (
                                            <Button
                                                onClick={open}
                                                variant="secondary"
                                            >
                                                {__('写真を変更')}
                                            </Button>
                                        )}
                                    />
                                </MediaUploadCheck>
                                <Button
                                    onClick={onRemoveImage}
                                    variant="link"
                                    isDestructive
                                >
                                    {__('写真を削除')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    },
    save: function(props) {
        // サーバーサイドレンダリングを使用するためnullを返す
        return null;
    }
}); 