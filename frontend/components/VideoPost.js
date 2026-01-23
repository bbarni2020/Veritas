import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {VideoView} from 'expo-video';
import {Ionicons} from '@expo/vector-icons';
import axios from 'axios';

export default function VideoPost({post}){
  async function like(){
    try{await axios.post(`http://localhost:8000/posts/${post.id}/like`, {}, {headers:{}})}catch(e){console.warn(e)}
  }
  async function repost(){
    try{await axios.post(`http://localhost:8000/posts/${post.id}/repost`, {}, {headers:{}})}catch(e){console.warn(e)}
  }

  return (
    <View style={styles.container}>
      <VideoView
        source={{ uri: post.video_url }}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="cover"
      />
      <View style={styles.overlay}>
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{post.caption || 'No caption'}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={like}>
            <Ionicons name="heart-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Ionicons name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={repost}>
            <Ionicons name="repeat-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>Repost</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  video: {
    width: '100%',
    height: 400,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captionContainer: {
    marginBottom: 10,
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
  },
});
