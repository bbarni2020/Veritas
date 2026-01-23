import React, {useEffect, useState} from 'react';
import {View, FlatList, StyleSheet, Text, RefreshControl} from 'react-native';
import VideoPost from '../components/VideoPost';
import axios from 'axios';

export default function FeedScreen(){
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(()=>{fetchFeed()},[]);

  async function fetchFeed(){
    try{
      const res = await axios.get('http://localhost:8000/posts');
      setPosts(res.data);
    }catch(e){console.warn(e)}
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={item=>String(item.id)}
        renderItem={({item})=> (
          <View style={styles.postContainer}>
            <VideoPost post={item} />
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  postContainer: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
