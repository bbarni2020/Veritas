import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VideoPost from '../components/VideoPost';
import axios from 'axios';
import config from '../config';

import { Dimensions } from 'react-native';

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const { height: windowHeight } = Dimensions.get('window');
  const containerHeight = windowHeight;

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  useEffect(() => { fetchFeed() }, []);

  async function fetchFeed() {
    try {
      const res = await axios.get(`${config.API_BASE_URL}/posts`);
      setPosts(res.data);
    } catch (e) { console.warn(e) }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setActiveIndex(index !== null ? index : 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={posts}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => (
          <View style={[styles.postContainer, { height: containerHeight }]}>
            <VideoPost post={item} isActive={index === activeIndex && isFocused} />
          </View>
        )}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={containerHeight}
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  postContainer: {
    height: '100%',
    marginBottom: 0,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
