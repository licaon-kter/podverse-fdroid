import { AppState, StyleSheet, TouchableOpacity } from 'react-native'
import { Icon } from 'react-native-elements'
import React from 'reactn'
import { ActivityIndicator, Divider, FlatList, PlaylistTableCell, View } from '../components'
import { PV } from '../resources'
import { getNowPlayingItem } from '../services/player'
import PlayerEventEmitter from '../services/playerEventEmitter'
import { setNowPlayingItem } from '../state/actions/player'
import { addOrRemovePlaylistItem } from '../state/actions/playlist'
import { getLoggedInUserPlaylists } from '../state/actions/user'

type Props = {
  navigation?: any
}

type State = {
  episodeId?: string
  isLoading: boolean
  mediaRefId?: string
}

export class PlaylistsAddToScreen extends React.Component<Props, State> {

  static navigationOptions = ({ navigation }) => ({
    title: 'Add to Playlist',
    headerLeft: (
      <TouchableOpacity
        onPress={navigation.dismiss}>
        <Icon
          color='#fff'
          iconStyle={styles.closeButton}
          name='angle-down'
          size={32}
          type='font-awesome'
          underlayColor={PV.Colors.brandColor} />
      </TouchableOpacity>
    ),
    headerRight: null
  })

  constructor(props: Props) {
    super(props)
    const { navigation } = props
    this.state = {
      episodeId: navigation.getParam('episodeId'),
      isLoading: true,
      mediaRefId: navigation.getParam('mediaRefId')
    }
  }

  async componentDidMount() {
    try {
      await getLoggedInUserPlaylists(this.global)
    } catch (error) {
      //
    }
    this.setState({ isLoading: false })

    AppState.addEventListener('change', this._handleAppStateChange)
    PlayerEventEmitter.on(PV.Events.PLAYER_QUEUE_ENDED, this._handleAppStateChange)
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this._handleAppStateChange)
    PlayerEventEmitter.removeListener(PV.Events.PLAYER_QUEUE_ENDED)
  }

  _handleAppStateChange = async () => {
    const { dismiss } = this.props.navigation
    const { nowPlayingItem: lastItem } = this.global
    const currentItem = await getNowPlayingItem()

    if (!currentItem) {
      dismiss()
    } else if (lastItem && currentItem.episodeId !== lastItem.episodeId) {
      await setNowPlayingItem(currentItem, this.global)
    }
  }

  _ItemSeparatorComponent = () => {
    return <Divider />
  }

  _renderPlaylistItem = ({ item }) => {
    const { episodeId, mediaRefId } = this.state

    return (
      <PlaylistTableCell
        key={`PlaylistsAddToScreen_${item.id}`}
        itemCount={item.itemCount}
        onPress={() => {
          try {
            addOrRemovePlaylistItem(item.id, episodeId, mediaRefId, this.global)
          } catch (error) {
            //
          }
        }}
        title={item.title} />
    )
  }

  render() {
    const { isLoading } = this.state
    const { myPlaylists } = this.global.playlists

    return (
      <View style={styles.view}>
        {
          isLoading &&
            <ActivityIndicator />
        }
        {
          !isLoading && myPlaylists && myPlaylists.length > 0 &&
            <FlatList
              data={myPlaylists}
              dataTotalCount={myPlaylists.length}
              disableLeftSwipe={true}
              extraData={myPlaylists}
              ItemSeparatorComponent={this._ItemSeparatorComponent}
              renderItem={this._renderPlaylistItem} />
        }
        {
          !isLoading && myPlaylists && myPlaylists.length === 0 &&
            <FlatList
              data={myPlaylists}
              dataTotalCount={0}
              disableLeftSwipe={true}
              extraData={myPlaylists}
              ItemSeparatorComponent={this._ItemSeparatorComponent}
              renderItem={this._renderPlaylistItem} />
        }
      </View>
    )
  }
}

const styles = StyleSheet.create({
  closeButton: {
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 8
  },
  view: {
    flex: 1
  }
})
