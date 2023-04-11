import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { List } from '@fluentui/react/lib/List';
import { mergeStyles } from '@fluentui/react/lib/Styling';

interface SearchItem {
    name: string;
    metadata: {
        title: string;
        description: string;
        publisher: string;
    };
}

interface SearchResultProps {
    item: SearchItem;
    onSelect: (item: SearchItem) => void;
}

const searchResultStyle = mergeStyles({
    cursor: 'pointer',
    padding: '4px',
    '&:hover': {
        backgroundColor: '#f3f2f1',
    },
});

const SearchResult: React.FC<SearchResultProps> = ({ item, onSelect }) => {
    return (
        <div className={searchResultStyle} onClick={() => onSelect(item) }>
            {item.metadata.title}
        </div>
    );
};

interface SearchComponentProps {
    endpoint: string;
}

const searchComponentStyle = mergeStyles({
    position: 'relative',
});

const floatingListStyle = mergeStyles({
    position: 'absolute',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 1,
});

const SearchComponent: React.FC<SearchComponentProps> = ({ endpoint }) => {
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
    const [searchString, setSearchString] = useState<string>('');
    const [isFocused, setIsFocused] = useState<boolean>(false);
    const [shouldBlur, setShouldBlur] = useState<boolean>(false); // Add this line
    //const searchBoxRef = useRef<ISearchBox>(null);

    const search = async (searchString: string) => {
        try {
            const response = await fetch(`${endpoint}?search=${encodeURIComponent(searchString)}`);
            const results = await response.json();
            setSearchResults(results);
        } catch (error) {
            console.error('Error fetching search results:', error);
        }
    };

    useEffect(() => {
        if (searchString.length >= 3) {
            search(searchString);
        } else {
            setSearchResults([]);
        }
    }, [searchString, endpoint]);

    const onSelect = useCallback((item: SearchItem) => {
        setSelectedItem(item);
        setIsFocused(false); // Hide the floating list after selecting an item
        setShouldBlur(true); // Set shouldBlur to true after selecting an item
        console.log('setShouldBlur')
    }, []);


    return (
        <div className={searchComponentStyle}>
            <SearchBox
                //componentRef={searchBoxRef}
                placeholder="Search items"
                onChange={(_, value) => setSearchString(value || '')}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    if (!shouldBlur) {
                        setTimeout(() => setIsFocused(false), 100);
                    }
                    setShouldBlur(false); // Reset shouldBlur after onBlur is called
                }}
                //value={searchString}
                showIcon={true}
            />
            <div className={floatingListStyle} style={{display: isFocused && searchResults.length > 0 ? 'block' : 'none'}}>
                <List
                    items={searchResults}
                    onRenderCell={(item: SearchItem) => (
                        <SearchResult key={item.name} item={item} onSelect={onSelect} />
                    )}
                />
            </div>
            
            {selectedItem && (
                <div>
                    <p>{selectedItem.metadata.publisher}</p>
                    <p>{selectedItem.metadata.title}</p>
                    <p>{selectedItem.metadata.description}</p>
                </div>
            )}
        </div>
    );
};

export default SearchComponent;
