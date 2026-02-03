import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Animated, ActivityIndicator, Modal, FlatList, Dimensions, Image, Linking } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import axios from 'axios';
import config from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
  'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Poland', 'Czech Republic',
  'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Portugal', 'Ukraine', 'Russia', 'Turkey', 'Israel', 'Saudi Arabia',
  'United Arab Emirates', 'Qatar', 'Kuwait', 'Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Ghana', 'Morocco',
  'India', 'China', 'Japan', 'South Korea', 'Singapore', 'Malaysia', 'Thailand', 'Indonesia', 'Philippines',
  'Vietnam', 'Pakistan', 'Bangladesh', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Mexico', 'Peru', 'Venezuela',
  'New Zealand', 'Iceland', 'Luxembourg', 'Malta', 'Cyprus', 'Croatia', 'Slovenia', 'Slovakia', 'Lithuania',
  'Latvia', 'Estonia', 'Albania', 'Serbia', 'Bosnia', 'Montenegro', 'North Macedonia', 'Armenia', 'Georgia',
  'Azerbaijan', 'Kazakhstan', 'Uzbekistan', 'Afghanistan', 'Iraq', 'Iran', 'Jordan', 'Lebanon', 'Syria', 'Yemen',
  'Oman', 'Bahrain', 'Palestine', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'Zambia', 'Zimbabwe', 'Botswana',
  'Namibia', 'Mozambique', 'Angola', 'Cameroon', 'Senegal', 'Ivory Coast', 'Mali', 'Burkina Faso', 'Niger',
  'Tunisia', 'Algeria', 'Libya', 'Sudan', 'Somalia', 'Other'
].sort();

const { width } = Dimensions.get('window');
const gridItemWidth = (width - 60) / 3;

export default function ProfileScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileCountry, setProfileCountry] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [posts, setPosts] = useState([]);
  const [captionEdits, setCaptionEdits] = useState({});
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [uploadPreviewVisible, setUploadPreviewVisible] = useState(false);
  const uploadPreviewPlayer = useVideoPlayer(uploadFile ? { uri: uploadFile.uri } : null, (player) => {
    if (player) {
      player.loop = true;
      player.muted = false;
    }
  });
  const [registerCountryPickerVisible, setRegisterCountryPickerVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLogin]);

  useEffect(() => {
    if (uploadPreviewVisible && uploadPreviewPlayer) {
      uploadPreviewPlayer.play();
    } else if (uploadPreviewPlayer) {
      uploadPreviewPlayer.pause();
    }
  }, [uploadPreviewVisible, uploadPreviewPlayer]);

  useEffect(() => {
    const loadAuth = async () => {
      const saved = await AsyncStorage.getItem('veritas_token');
      if (saved) {
        setToken(saved);
        await hydrateProfile(saved);
      }
      setLoading(false);
    };
    loadAuth();
  }, []);

  const authHeaders = (t = token) => ({ Authorization: `Bearer ${t}` });

  const hydrateProfile = async (t) => {
    try {
      const res = await axios.get(`${config.API_BASE_URL}/me`, { headers: authHeaders(t) });
      setUser(res.data);
      setProfileName(res.data.username || '');
      setProfileCountry(res.data.country || '');
      await fetchPosts(t);
    } catch (e) {
      await AsyncStorage.removeItem('veritas_token');
      setToken(null);
      setUser(null);
    }
  };

  const fetchPosts = async (t = token) => {
    setLoadingPosts(true);
    try {
      const res = await axios.get(`${config.API_BASE_URL}/me/posts`, { headers: authHeaders(t) });
      setPosts(res.data);
      const next = {};
      res.data.forEach(p => {
        next[p.id] = p.caption || '';
      });
      setCaptionEdits(next);
    } catch (e) {
      Alert.alert('Error', 'Could not load posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      if (isLogin) {
        const res = await axios.post(`${config.API_BASE_URL}/auth/login`, { username, password });
        await AsyncStorage.setItem('veritas_token', res.data.access_token);
        setToken(res.data.access_token);
        await hydrateProfile(res.data.access_token);
        setPassword('');
      } else {
        if (!country.trim()) {
          Alert.alert('Error', 'Please select your country');
          return;
        }
        await axios.post(`${config.API_BASE_URL}/auth/register`, { username, password, country });
        const res = await axios.post(`${config.API_BASE_URL}/auth/login`, { username, password });
        await AsyncStorage.setItem('veritas_token', res.data.access_token);
        setToken(res.data.access_token);
        await hydrateProfile(res.data.access_token);
        setPassword('');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Something went wrong');
    }
  }

  const logout = async () => {
    await AsyncStorage.removeItem('veritas_token');
    setToken(null);
    setUser(null);
    setPosts([]);
    setCaptionEdits({});
    setUsername('');
    setPassword('');
    setCountry('');
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      const res = await axios.patch(`${config.API_BASE_URL}/me`, { username: profileName.trim(), country: profileCountry.trim() || null }, { headers: authHeaders() });
      setUser(res.data);
      Alert.alert('Saved', 'Profile updated');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Update failed');
    }
  };

  const changePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await axios.post(`${config.API_BASE_URL}/me/password`, { current_password: currentPassword, new_password: newPassword }, { headers: authHeaders() });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Updated', 'Password changed');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Password change failed');
    } finally {
      setChangingPassword(false);
    }
  };

  const pickVideo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (res.canceled || !res.assets || !res.assets.length) return;
    setUploadFile(res.assets[0]);
    setUploadPreviewVisible(true);
  };

  const uploadVideo = async () => {
    if (!uploadFile) {
      Alert.alert('Error', 'Choose a video file');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', {
        uri: uploadFile.uri,
        name: uploadFile.name || 'upload.mp4',
        type: uploadFile.mimeType || 'video/mp4',
      });
      if (uploadCaption.trim()) {
        form.append('caption', uploadCaption.trim());
      }
      await axios.post(`${config.API_BASE_URL}/me/posts/upload`, form, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
      setUploadCaption('');
      setUploadPreviewVisible(false);
      setUploadFile(null);
      await fetchPosts();
      Alert.alert('Uploaded', 'Your video is processing');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const pickProfilePicture = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled) return;
    try {
      const form = new FormData();
      form.append('file', {
        uri: res.assets[0].uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      });
      const response = await axios.post(`${config.API_BASE_URL}/me/profile-picture`, form, { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' } });
      setUser(response.data);
      Alert.alert('Success', 'Profile picture updated');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Upload failed');
    }
  };

  const openEditModal = (post) => {
    setSelectedPost(post);
    setEditCaption(post.caption || '');
    setEditModalVisible(true);
  };

  const saveCaption = async () => {
    if (!selectedPost) return;
    try {
      await axios.patch(`${config.API_BASE_URL}/posts/${selectedPost.id}`, { caption: editCaption || '' }, { headers: authHeaders() });
      await fetchPosts();
      setEditModalVisible(false);
      Alert.alert('Saved', 'Caption updated');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Update failed');
    }
  };

  const deletePost = async (postId) => {
    Alert.alert('Delete video', 'This will remove the post', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${config.API_BASE_URL}/posts/${postId}`, { headers: authHeaders() });
            await fetchPosts();
            setEditModalVisible(false);
          } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || 'Delete failed');
          }
        }
      }
    ]);
  };

  const handleModeSwitch = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsLogin(!isLogin);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!token) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Ionicons name="book" size={56} color="#fff" />
            <Text style={styles.appName}>Veritas</Text>
            <Text style={styles.subtitle}>Bible-Based Community</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.formWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <BlurView intensity={50} tint="dark" style={styles.formContainer}>
            <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Join Veritas'}</Text>
            <Text style={styles.formSubtitle}>
              {isLogin ? 'Sign in to your account' : 'Create your account to begin'}
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="person" size={18} color="#fff" style={styles.inputIcon} />
              <TextInput
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                autoCapitalize="none"
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={18} color="#fff" style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
                placeholderTextColor="#8E8E93"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {!isLogin && (
              <TouchableOpacity style={styles.inputWrapper} onPress={() => setRegisterCountryPickerVisible(true)}>
                <Ionicons name="globe" size={18} color="#fff" style={styles.inputIcon} />
                <Text style={[styles.input, { paddingTop: 18 }]}>
                  {country || 'Select Country'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#8E8E93" style={styles.eyeIcon} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} activeOpacity={0.8}>
              <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity onPress={handleModeSwitch} style={styles.switchButton}>
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.switchLink}>{isLogin ? 'Register' : 'Sign In'}</Text>
              </Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>"For God so loved the world..." - John 3:16</Text>
        </View>

        <Modal visible={registerCountryPickerVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <BlurView intensity={80} tint="dark" style={styles.pickerModal}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Country</Text>
                <TouchableOpacity onPress={() => setRegisterCountryPickerVisible(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={COUNTRIES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryItem}
                    onPress={() => {
                      setCountry(item);
                      setRegisterCountryPickerVisible(false);
                    }}
                  >
                    <Text style={styles.countryText}>{item}</Text>
                    {country === item && <Ionicons name="checkmark" size={22} color="#fff" />}
                  </TouchableOpacity>
                )}
              />
            </BlurView>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickProfilePicture} style={styles.profileBadge}>
            {user?.profile_picture ? (
              <Image source={{ uri: user.profile_picture }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person" size={28} color="#fff" />
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.username || 'User'}</Text>
            <Text style={styles.profileMeta}>{user?.country || 'No country set'}</Text>
          </View>
          <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.settingsButton}>
            <Ionicons name="settings" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <BlurView intensity={45} tint="dark" style={styles.uploadCard}>
          <TouchableOpacity onPress={pickVideo} style={styles.uploadButton}>
            <Ionicons name="cloud-upload" size={24} color="#fff" />
            <Text style={styles.uploadButtonText}>Upload Video</Text>
          </TouchableOpacity>
        </BlurView>

        <View style={styles.videosSection}>
          <View style={styles.videosSectionHeader}>
            <Text style={styles.videosSectionTitle}>Your Videos</Text>
            <TouchableOpacity onPress={() => fetchPosts()} style={styles.refreshButton}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {loadingPosts && (
            <View style={styles.loadingInline}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}

          {!loadingPosts && posts.length === 0 && (
            <Text style={styles.emptyText}>No uploads yet</Text>
          )}

          {!loadingPosts && posts.length > 0 && (
            <View style={styles.videoGrid}>
              {posts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.gridItem}
                  onPress={() => openEditModal(post)}
                  activeOpacity={0.7}
                >
                  <View style={styles.videoThumb}>
                    <Ionicons name="videocam" size={32} color="#8E8E93" />
                  </View>
                  <View style={styles.videoStatus}>
                    <Text style={styles.videoStatusText}>{post.processing_status || 'uploaded'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={settingsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.settingsModal}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Profile</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person" size={18} color="#fff" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Username"
                    value={profileName}
                    onChangeText={setProfileName}
                    style={styles.input}
                    autoCapitalize="none"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <TouchableOpacity style={styles.inputWrapper} onPress={() => setCountryPickerVisible(true)}>
                  <Ionicons name="globe" size={18} color="#fff" style={styles.inputIcon} />
                  <Text style={[styles.input, { paddingTop: 18 }]}>
                    {profileCountry || 'Select Country'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#8E8E93" style={styles.eyeIcon} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={saveProfile} activeOpacity={0.8}>
                  <Text style={styles.buttonText}>Save Profile</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Change Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed" size={18} color="#fff" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Current password"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    style={styles.input}
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="key" size={18} color="#fff" style={styles.inputIcon} />
                  <TextInput
                    placeholder="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    style={styles.input}
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="key" size={18} color="#fff" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={styles.input}
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <TouchableOpacity style={styles.button} onPress={changePassword} activeOpacity={0.8} disabled={changingPassword}>
                  <Text style={styles.buttonText}>{changingPassword ? 'Updating...' : 'Update Password'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingsSection}>
                <TouchableOpacity style={styles.logoutButtonFull} onPress={logout}>
                  <Ionicons name="log-out" size={18} color="#fff" />
                  <Text style={styles.logoutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={countryPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    setProfileCountry(item);
                    setCountryPickerVisible(false);
                  }}
                >
                  <Text style={styles.countryText}>{item}</Text>
                  {profileCountry === item && <Ionicons name="checkmark" size={22} color="#fff" />}
                </TouchableOpacity>
              )}
            />
          </BlurView>
        </View>
      </Modal>

      <Modal visible={uploadPreviewVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.uploadPreviewModal}>
            <View style={styles.uploadHeader}>
              <View>
                <Text style={styles.uploadTitle}>Upload video</Text>
                <Text style={styles.uploadSubtitle}>Preview + caption</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setUploadPreviewVisible(false);
                setUploadFile(null);
                setUploadCaption('');
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.uploadPreviewContent}>
              {uploadFile && (
                <TouchableOpacity onPress={pickVideo} activeOpacity={0.85} style={styles.uploadVideoPreview}>
                  <VideoView
                    player={uploadPreviewPlayer}
                    style={styles.uploadVideo}
                    contentFit="cover"
                    nativeControls={false}
                  />
                  <View style={styles.changeBadge}>
                    <Ionicons name="pencil" size={14} color="#fff" />
                    <Text style={styles.changeBadgeText}>Change</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.playButton}
                    onPress={() => {
                      if (uploadPreviewPlayer) {
                        if (uploadPreviewPlayer.playing) {
                          uploadPreviewPlayer.pause();
                        } else {
                          uploadPreviewPlayer.play();
                        }
                      }
                    }}
                  >
                    <Ionicons name="play-circle" size={60} color="rgba(255,255,255,0.85)" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={pickVideo} activeOpacity={0.85} style={styles.uploadMetaRow}>
                <View style={styles.uploadMetaIcon}>
                  <Ionicons name="film" size={18} color="#fff" />
                </View>
                <Text style={styles.uploadMetaText} numberOfLines={1}>
                  {uploadFile?.fileName || uploadFile?.name || 'Selected video'}
                </Text>
                <TouchableOpacity onPress={pickVideo} style={styles.uploadChangeButton}>
                  <Text style={styles.uploadChangeText}>Change</Text>
                </TouchableOpacity>
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <Ionicons name="text" size={18} color="#fff" style={styles.inputIcon} />
                <TextInput
                  placeholder="Add a caption..."
                  value={uploadCaption}
                  onChangeText={setUploadCaption}
                  style={styles.input}
                  placeholderTextColor="#8E8E93"
                  multiline
                />
              </View>
              <View style={styles.uploadActionsRow}>
                <TouchableOpacity 
                  style={styles.uploadSecondaryButton}
                  onPress={() => {
                    setUploadPreviewVisible(false);
                    setUploadFile(null);
                    setUploadCaption('');
                  }}
                >
                  <Text style={styles.uploadSecondaryText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.uploadPrimaryButton]} 
                  onPress={uploadVideo} 
                  activeOpacity={0.8} 
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.buttonText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.editModal}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Video #{selectedPost?.id}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.editContent}>
              <View style={styles.videoPreview}>
                <Ionicons name="videocam" size={48} color="#8E8E93" />
                <Text style={styles.videoPreviewStatus}>{selectedPost?.processing_status || 'uploaded'}</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Ionicons name="text" size={18} color="#fff" style={styles.inputIcon} />
                <TextInput
                  placeholder="Caption"
                  value={editCaption}
                  onChangeText={setEditCaption}
                  style={styles.input}
                  placeholderTextColor="#8E8E93"
                  multiline
                />
              </View>
              <TouchableOpacity style={styles.button} onPress={saveCaption} activeOpacity={0.8}>
                <Ionicons name="save" size={18} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Save Caption</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerButton} onPress={() => deletePost(selectedPost?.id)}>
                <Ionicons name="trash" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.dangerButtonText}>Delete Video</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  profileContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
    gap: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    marginTop: 20,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  formWrapper: {
    marginBottom: 24,
  },
  formContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  formSubtitle: {
    fontSize: 15,
    color: '#a1a1a6',
    marginBottom: 28,
    fontWeight: '500',
    lineHeight: 22,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    marginBottom: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 24,
  },
  switchButton: {
    alignItems: 'center',
  },
  switchText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '500',
  },
  switchLink: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  footerText: {
    color: '#555',
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  profileBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  profileMeta: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  uploadCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    gap: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  videosSection: {
    gap: 16,
  },
  videosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videosSectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  refreshButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 40,
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: gridItemWidth,
    height: gridItemWidth * 1.5,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  videoThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoStatus: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  videoStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingInline: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  settingsModal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '85%',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  settingsSection: {
    padding: 24,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingsSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  logoutButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerModal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  countryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  editModal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '75%',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  editTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  editContent: {
    padding: 24,
    gap: 16,
  },
  videoPreview: {
    height: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  videoPreviewStatus: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadPreviewModal: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxHeight: '90%',
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  uploadTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  uploadSubtitle: {
    color: '#a1a1a6',
    fontSize: 13,
    marginTop: 2,
  },
  uploadPreviewContent: {
    padding: 20,
    gap: 16,
  },
  uploadVideoPreview: {
    height: 320,
    backgroundColor: '#000',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  uploadVideo: {
    width: '100%',
    height: '100%',
  },
  changeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  changeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  uploadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  uploadMetaIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  uploadMetaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  uploadChangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  uploadChangeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadActionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  uploadSecondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  uploadSecondaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  uploadPrimaryButton: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },

});
