import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import axios from 'axios';
import config from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

function extractKeyFromUrl(url){
  try{
    const u = new URL(url)
    const parts = u.pathname.split('/')
    if(parts.length>=3){
      return parts.slice(2).join('/')
    }
    return u.pathname.replace(/^\/+/, '')
  }catch(e){
    return url
  }
}

export default function VideoPost({ post, isActive }) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [following, setFollowing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const repostScale = useRef(new Animated.Value(1)).current;
  const followScale = useRef(new Animated.Value(1)).current;
  const followOpacity = useRef(new Animated.Value(1)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const doubleTapHeartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef({ current: null, timeout: null });

  let sourceUri = null
  if(post.mp4_url){
    sourceUri = `${config.MEDIA_URL}/${extractKeyFromUrl(post.mp4_url)}`
  } else if(post.webm_url){
    sourceUri = `${config.MEDIA_URL}/${extractKeyFromUrl(post.webm_url)}`
  } else if(post.hls_url){
    sourceUri = `${config.MEDIA_URL}/${extractKeyFromUrl(post.hls_url)}`
  } else if(post.video_url){
    sourceUri = `${config.MEDIA_URL}/${extractKeyFromUrl(post.video_url)}`
  }

  const player = useVideoPlayer(sourceUri ? { uri: sourceUri } : null, (player) => {
    player.loop = true;
    player.muted = isMuted;
  });

  useEffect(() => {
    if (player) {
      if (isActive && isPlaying) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isActive, isPlaying, player]);

  useEffect(() => {
    const checkFollowing = async () => {
      if (!post.owner) return;
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(`${config.API_BASE_URL}/users/${post.owner_id}/is-following`, { headers });
        const isFollowing = res.data.following;
        setFollowing(isFollowing);
        // Initialize animation values based on following state
        checkmarkScale.setValue(isFollowing ? 1 : 0);
        followOpacity.setValue(isFollowing ? 0 : 1);
      } catch (e) {}
    };
    checkFollowing();
  }, [post.owner_id]);

  const animateButton = (scale) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('veritas_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  async function handleLike(isDoubleTap = false) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLiked(!liked);
    animateButton(likeScale);
    
    if (isDoubleTap) {
      // Animate the big heart overlay
      Animated.sequence([
        Animated.spring(doubleTapHeartScale, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(doubleTapHeartScale, {
          toValue: 0,
          delay: 400,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    try { await axios.post(`${config.API_BASE_URL}/posts/${post.id}/like`, {}, { headers: await getAuthHeaders() }) } catch (e) { console.warn(e) }
  }

  async function handleRepost() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReposted(!reposted);
    animateButton(repostScale);
    try { await axios.post(`${config.API_BASE_URL}/posts/${post.id}/repost`, {}, { headers: await getAuthHeaders() }) } catch (e) { console.warn(e) }
  }

  async function handleFollow() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await axios.post(`${config.API_BASE_URL}/users/${post.owner_id}/follow`, {}, { headers: await getAuthHeaders() });
      const nowFollowing = res.data.following;
      
      if (nowFollowing) {
        // Following animation - scale bounce + checkmark pop
        Animated.parallel([
          Animated.sequence([
            Animated.timing(followScale, {
              toValue: 1.3,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.spring(followScale, {
              toValue: 1,
              friction: 3,
              tension: 40,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(followOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(followOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.spring(checkmarkScale, {
            toValue: 1,
            friction: 4,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Unfollowing animation - just bounce
        Animated.parallel([
          Animated.sequence([
            Animated.timing(followScale, {
              toValue: 0.8,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.spring(followScale, {
              toValue: 1,
              friction: 3,
              tension: 40,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(checkmarkScale, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      }
      
      setFollowing(nowFollowing);
    } catch (e) { console.warn(e) }
  }

  const handleVideoPress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (lastTap.current.current && now - lastTap.current.current < DOUBLE_TAP_DELAY) {
      // Double tap detected - like the video
      if (lastTap.current.timeout) {
        clearTimeout(lastTap.current.timeout);
      }
      lastTap.current.current = null;
      handleLike(true);
    } else {
      // Single tap - schedule play/pause
      lastTap.current.current = now;
      lastTap.current.timeout = setTimeout(() => {
        if (lastTap.current.current === now) {
          // Confirmed single tap
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const newPlayingState = !isPlaying;
          setIsPlaying(newPlayingState);
          if (player) {
            if (newPlayingState) {
              player.play();
            } else {
              player.pause();
            }
          }
          lastTap.current.current = null;
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
    if (player) {
      player.muted = !isMuted;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={1} onPress={handleVideoPress} style={styles.videoContainer}>
        {sourceUri && player ? (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={[styles.video, {backgroundColor:'#000', alignItems:'center', justifyContent:'center'}]}>
            <Ionicons name="videocam-off" size={60} color="#475569" />
            <Text style={{color:'#94a3b8', marginTop: 12, fontSize: 14}}>No video available</Text>
          </View>
        )}
      </TouchableOpacity>

      {!isPlaying && (
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={64} color="#fff" />
        </View>
      )}

      <View style={styles.doubleTapHeartContainer} pointerEvents="none">
        <Animated.View style={{ transform: [{ scale: doubleTapHeartScale }] }}>
          <Ionicons name="heart" size={120} color="#fff" />
        </Animated.View>
      </View>

      <TouchableOpacity activeOpacity={0.7} onPress={handleMute} style={styles.muteButton}>
        <BlurView intensity={40} tint="dark" style={styles.actionButtonGlass}>
          <Ionicons 
            name={isMuted ? "volume-mute" : "volume-high"} 
            size={24} 
            color="#fff" 
          />
        </BlurView>
      </TouchableOpacity>
      
      <View style={styles.rightActions}>
        <TouchableOpacity activeOpacity={0.7} onPress={handleLike}>
          <BlurView intensity={40} tint="dark" style={styles.actionButtonGlass}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons 
                name={liked ? "heart" : "heart-outline"} 
                size={28} 
                color={liked ? "#ff3b5c" : "#fff"} 
              />
            </Animated.View>
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7}>
          <BlurView intensity={40} tint="dark" style={styles.actionButtonGlass}>
            <Ionicons name="chatbubble-outline" size={26} color="#fff" />
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} onPress={handleRepost}>
          <BlurView intensity={40} tint="dark" style={styles.actionButtonGlass}>
            <Animated.View style={{ transform: [{ scale: repostScale }] }}>
              <Ionicons 
                name={reposted ? "repeat" : "repeat-outline"} 
                size={28} 
                color={reposted ? "#34d399" : "#fff"} 
              />
            </Animated.View>
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7}>
          <BlurView intensity={40} tint="dark" style={styles.actionButtonGlass}>
            <Ionicons name="share-outline" size={26} color="#fff" />
          </BlurView>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomWrapper}>
        <BlurView intensity={50} tint="dark" style={styles.userBubble}>
          <View style={styles.avatar}>
            {post.owner?.profile_picture ? (
              <Image source={{ uri: post.owner.profile_picture }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={18} color="#fff" />
            )}
          </View>
          <Text style={styles.username}>@{post.owner?.username || `user${post.owner_id}`}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleFollow} style={styles.followButton}>
            <Animated.View style={{ 
              transform: [{ scale: followScale }],
              position: 'relative',
              width: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Animated.View style={{ 
                position: 'absolute',
                opacity: followOpacity 
              }}>
                <Ionicons 
                  name="person-add" 
                  size={20} 
                  color="#fff" 
                />
              </Animated.View>
              <Animated.View style={{ 
                position: 'absolute',
                transform: [{ scale: checkmarkScale }]
              }}>
                <Ionicons 
                  name="checkmark-circle" 
                  size={20} 
                  color="#34d399" 
                />
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>
        </BlurView>
        
        {(post.caption && post.caption.trim()) && (
          <BlurView intensity={45} tint="dark" style={styles.captionBubble}>
            <Text style={styles.caption} numberOfLines={4}>
              {post.caption}
            </Text>
          </BlurView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 5,
  },
  doubleTapHeartContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  muteButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    gap: 16,
  },
  actionButtonGlass: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bottomWrapper: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 80,
    gap: 10,
  },
  userBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    paddingRight: 18,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
  },
  followButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionBubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  caption: {
    color: 'rgba(255, 255, 255, 0.98)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
