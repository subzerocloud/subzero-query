import React, { useState, useEffect } from 'react';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { List } from '@fluentui/react/lib/List';
import { useTheme } from '@fluentui/react/lib/Theme';
import { mergeStyles } from '@fluentui/react/lib/Styling';

interface SearchItem {
    name: string;
    metadata: {
        title: string;
        description: string;
        publisher: string;
    };
}

interface SearchComponentProps {
    endpoint: string;
    onSelect?: (item: SearchItem) => void;
}

const SearchComponent: React.FC<SearchComponentProps> = ({ endpoint, onSelect }) => {
    const theme = useTheme();
    const [searchString, setSearchString] = useState<string>('');
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [isFocused, setIsFocused] = useState<boolean>(false);

    const searchComponentStyle = mergeStyles({
        position: 'relative',
    });

    const searchResultStyle = mergeStyles({
        cursor: 'pointer',
        padding: theme.spacing.s1,
        ':hover': {
            backgroundColor: theme.palette.neutralLighter,
        },
    });

    const floatingListStyle = mergeStyles({
        position: 'absolute',
        backgroundColor: theme.palette.white,
        border: `1px solid ${theme.palette.neutralLight}`,
        borderRadius: theme.effects.roundedCorner2,
        maxHeight: '200px',
        overflowY: 'auto',
        zIndex: 1,
    });

    useEffect(() => {
        const search = async (searchString: string) => {
            if (searchString.length < 3) {
                setSearchResults([]);
                return;
            }

            try {
                const response = await fetch(`${endpoint}?search=${encodeURIComponent(searchString)}`);
                const results = await response.json();
                setSearchResults(results);
            } catch (error) {
                console.error('Error fetching search results:', error);
            }
        };

        const searchTimeout = setTimeout(() => {
            search(searchString);
        }, 300);

        return () => {
            clearTimeout(searchTimeout);
        };
    }, [searchString, endpoint]);

    const handleSelect = (item: SearchItem) => {
        onSelect?.(item);
    };

    return (
        <div className={searchComponentStyle}>
            <SearchBox
                placeholder="Search datasets..."
                onChange={(_, value) => setSearchString(value || '')}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                showIcon={true}
            />
            <div
                className={floatingListStyle}
                style={{
                    display: isFocused && searchResults.length > 0 ? 'block' : 'none',
                }}
            >
                <List
                    items={searchResults}
                    onRenderCell={(item: SearchItem) => (
                        <div
                            className={searchResultStyle}
                            key={item.name}
                            onMouseDown={() => handleSelect(item)}
                        >
                            {item.metadata.title}
                        </div>
                    )}
                />
            </div>
        </div>
    );
};

export default SearchComponent;
