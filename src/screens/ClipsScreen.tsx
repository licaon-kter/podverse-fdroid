import debounce from 'lodash/debounce'
import { Alert } from 'react-native'
import Dialog from 'react-native-dialog'
import React from 'reactn'
import {
  ActionSheet,
  ActivityIndicator,
  ClipTableCell,
  Divider,
  FlatList,
  SearchBar,
  SwipeRowBack,
  TableSectionSelectors,
  View
} from '../components'
import { getDownloadedEpisodeIds } from '../lib/downloadedPodcast'
import { downloadEpisode } from '../lib/downloader'
import { hasValidNetworkConnection } from '../lib/network'
import { convertNowPlayingItemToEpisode, convertToNowPlayingItem } from '../lib/NowPlayingItem'
import { generateCategoryItems, isOdd, safelyUnwrapNestedVariable } from '../lib/utility'
import { PV } from '../resources'
import { getCategoryById, getTopLevelCategories } from '../services/category'
import { gaTrackPageView } from '../services/googleAnalytics'
import { deleteMediaRef, getMediaRefs } from '../services/mediaRef'
import { getLoggedInUserMediaRefs } from '../services/user'
import { loadItemAndPlayTrack } from '../state/actions/player'
import { core } from '../styles'

type Props = {
  navigation?: any
}

type State = {
  categoryItems: any[]
  endOfResultsReached: boolean
  flatListData: any[]
  flatListDataTotalCount: number | null
  hideRightItemWhileLoading: boolean
  isLoading: boolean
  isLoadingMore: boolean
  isRefreshing: boolean
  mediaRefIdToDelete?: string
  queryFrom: string | null
  queryPage: number
  querySort: string | null
  searchBarText: string
  selectedCategory: string | null
  selectedItem?: any
  selectedSubCategory: string | null
  showActionSheet: boolean
  showDeleteConfirmDialog?: boolean
  showNoInternetConnectionMessage?: boolean
  subCategoryItems: any[]
}

export class ClipsScreen extends React.Component<Props, State> {
  static navigationOptions = {
    title: 'Clips'
  }

  constructor(props: Props) {
    super(props)

    const { subscribedPodcastIds } = this.global.session.userInfo

    this.state = {
      categoryItems: [],
      endOfResultsReached: false,
      flatListData: [],
      flatListDataTotalCount: null,
      hideRightItemWhileLoading: false,
      isLoading: true,
      isLoadingMore: false,
      isRefreshing: false,
      queryFrom: subscribedPodcastIds && subscribedPodcastIds.length > 0 ? _subscribedKey : _allPodcastsKey,
      queryPage: 1,
      querySort: subscribedPodcastIds && subscribedPodcastIds.length > 0 ? _mostRecentKey : _topPastWeek,
      searchBarText: '',
      selectedCategory: null,
      selectedSubCategory: null,
      showActionSheet: false,
      subCategoryItems: []
    }

    this._handleSearchBarTextQuery = debounce(this._handleSearchBarTextQuery, PV.SearchBar.textInputDebounceTime)
  }

  async componentDidMount() {
    const { queryFrom } = this.state
    const newState = await this._queryData(queryFrom)
    this.setState(newState)
    gaTrackPageView('/clips', 'Clips Screen')
  }

  selectLeftItem = async (selectedKey: string) => {
    if (!selectedKey) {
      this.setState({ queryFrom: null })
      return
    }

    const { querySort } = this.state

    let sort = querySort
    let hideRightItemWhileLoading = false
    if (
      (selectedKey === _allPodcastsKey || selectedKey === _categoryKey) &&
      (querySort === _mostRecentKey || querySort === _randomKey)
    ) {
      sort = _topPastWeek
      hideRightItemWhileLoading = true
    } else if (selectedKey === _downloadedKey) {
      sort = _mostRecentKey
      hideRightItemWhileLoading = true
    }

    this.setState(
      {
        endOfResultsReached: false,
        flatListData: [],
        flatListDataTotalCount: null,
        hideRightItemWhileLoading,
        isLoading: true,
        queryFrom: selectedKey,
        queryPage: 1,
        querySort: sort,
        searchBarText: ''
      },
      async () => {
        const newState = await this._queryData(selectedKey)
        this.setState(newState)
      }
    )
  }

  selectRightItem = async (selectedKey: string) => {
    if (!selectedKey) {
      this.setState({ querySort: null })
      return
    }

    this.setState(
      {
        endOfResultsReached: false,
        flatListData: [],
        flatListDataTotalCount: null,
        isLoading: true,
        queryPage: 1,
        querySort: selectedKey
      },
      async () => {
        const newState = await this._queryData(selectedKey)
        this.setState(newState)
      }
    )
  }

  _selectCategory = async (selectedKey: string, isSubCategory?: boolean) => {
    if (!selectedKey) {
      this.setState({
        ...((isSubCategory ? { selectedSubCategory: null } : { selectedCategory: null }) as any)
      })
      return
    }

    this.setState(
      {
        endOfResultsReached: false,
        isLoading: true,
        ...((isSubCategory ? { selectedSubCategory: selectedKey } : { selectedCategory: selectedKey }) as any),
        ...(!isSubCategory ? { subCategoryItems: [] } : {}),
        flatListData: [],
        flatListDataTotalCount: null,
        queryPage: 1
      },
      async () => {
        const newState = await this._queryData(selectedKey, { isSubCategory })
        this.setState(newState)
      }
    )
  }

  _onEndReached = ({ distanceFromEnd }) => {
    const { endOfResultsReached, isLoadingMore, queryFrom, queryPage = 1 } = this.state
    if (!endOfResultsReached && !isLoadingMore) {
      if (distanceFromEnd > -1) {
        this.setState(
          {
            isLoadingMore: true,
            queryPage: queryPage + 1
          },
          async () => {
            const newState = await this._queryData(queryFrom, {
              queryPage: this.state.queryPage,
              searchAllFieldsText: this.state.searchBarText
            })
            this.setState(newState)
          }
        )
      }
    }
  }

  _onRefresh = () => {
    const { queryFrom } = this.state

    this.setState(
      {
        isRefreshing: true
      },
      async () => {
        const newState = await this._queryData(queryFrom, {
          queryPage: 1,
          searchAllFieldsText: this.state.searchBarText
        })
        this.setState(newState)
      }
    )
  }

  _ListHeaderComponent = () => {
    const { searchBarText } = this.state

    return (
      <View style={core.ListHeaderComponent}>
        <SearchBar
          inputContainerStyle={core.searchBar}
          onChangeText={this._handleSearchBarTextChange}
          onClear={this._handleSearchBarClear}
          value={searchBarText}
        />
      </View>
    )
  }

  _ItemSeparatorComponent = () => {
    return <Divider />
  }

  _handleCancelPress = () => {
    return new Promise((resolve, reject) => {
      this.setState({ showActionSheet: false }, resolve)
    })
  }

  _handleMorePress = (selectedItem: any) => {
    this.setState({
      selectedItem,
      showActionSheet: true
    })
  }

  _renderClipItem = ({ item, index }) => {
    return item && item.episode && item.episode.id ? (
      <ClipTableCell
        endTime={item.endTime}
        episodeId={item.episode.id}
        episodePubDate={item.episode.pubDate}
        episodeTitle={item.episode.title}
        handleMorePress={() => this._handleMorePress(convertToNowPlayingItem(item, null, null))}
        handleNavigationPress={() => this._handleNavigationPress(convertToNowPlayingItem(item, null, null))}
        hasZebraStripe={isOdd(index)}
        podcastImageUrl={item.episode.podcast.shrunkImageUrl || item.episode.podcast.imageUrl}
        podcastTitle={item.episode.podcast.title}
        startTime={item.startTime}
        title={item.title || 'untitled clip'}
      />
    ) : (
      <></>
    )
  }

  _handleSearchBarClear = (text: string) => {
    this.setState({
      flatListData: [],
      flatListDataTotalCount: null,
      searchBarText: ''
    })
  }

  _handleSearchBarTextChange = (text: string) => {
    const { queryFrom } = this.state

    this.setState(
      {
        isLoadingMore: true,
        searchBarText: text
      },
      async () => {
        this._handleSearchBarTextQuery(queryFrom, {
          searchAllFieldsText: text
        })
      }
    )
  }

  _handleSearchBarTextQuery = async (queryFrom: string | null, queryOptions: any) => {
    this.setState(
      {
        flatListData: [],
        flatListDataTotalCount: null,
        queryPage: 1
      },
      async () => {
        const state = await this._queryData(queryFrom, {
          searchAllFieldsText: queryOptions.searchAllFieldsText
        })
        this.setState(state)
      }
    )
  }

  _handleDownloadPressed = () => {
    if (this.state.selectedItem) {
      const episode = convertNowPlayingItemToEpisode(this.state.selectedItem)
      downloadEpisode(episode, episode.podcast)
    }
  }

  _renderHiddenItem = ({ item }, rowMap) => (
    <SwipeRowBack onPress={() => this._handleHiddenItemPress(item.id, rowMap)} text='Delete' />
  )

  _handleHiddenItemPress = (selectedId, rowMap) => {
    this.setState({
      mediaRefIdToDelete: selectedId,
      showDeleteConfirmDialog: true
    })
  }

  _handleSearchNavigation = () => {
    this.props.navigation.navigate(PV.RouteNames.SearchScreen)
  }

  _deleteMediaRef = async () => {
    const { mediaRefIdToDelete } = this.state
    let { flatListData, flatListDataTotalCount } = this.state

    if (mediaRefIdToDelete) {
      this.setState(
        {
          isLoading: true,
          showDeleteConfirmDialog: false
        },
        async () => {
          try {
            await deleteMediaRef(mediaRefIdToDelete)
            flatListData = flatListData.filter((x: any) => x.id !== mediaRefIdToDelete)
            flatListDataTotalCount = flatListData.length
          } catch (error) {
            if (error.response) {
              Alert.alert(
                PV.Alerts.SOMETHING_WENT_WRONG.title,
                PV.Alerts.SOMETHING_WENT_WRONG.message,
                PV.Alerts.BUTTONS.OK
              )
            }
          }
          this.setState({
            flatListData,
            flatListDataTotalCount,
            isLoading: false,
            mediaRefIdToDelete: ''
          })
        }
      )
    }
  }

  _cancelDeleteMediaRef = async () => {
    this.setState({
      mediaRefIdToDelete: '',
      showDeleteConfirmDialog: false
    })
  }

  _handleNavigationPress = (selectedItem: any) => {
    const shouldPlay = true
    loadItemAndPlayTrack(selectedItem, shouldPlay)
  }

  render() {
    const { navigation } = this.props
    const {
      categoryItems,
      flatListData,
      flatListDataTotalCount,
      hideRightItemWhileLoading,
      isLoading,
      isLoadingMore,
      isRefreshing,
      queryFrom,
      querySort,
      searchBarText,
      selectedCategory,
      selectedItem,
      selectedSubCategory,
      showActionSheet,
      showDeleteConfirmDialog,
      showNoInternetConnectionMessage,
      subCategoryItems
    } = this.state
    const { session } = this.global
    const { isLoggedIn } = session

    return (
      <View style={styles.view}>
        <TableSectionSelectors
          handleSelectLeftItem={this.selectLeftItem}
          handleSelectRightItem={this.selectRightItem}
          leftItems={leftItems(isLoggedIn)}
          rightItems={queryFrom && !hideRightItemWhileLoading ? rightItems : []}
          selectedLeftItemKey={queryFrom}
          selectedRightItemKey={querySort}
        />
        {queryFrom === _categoryKey && categoryItems && (
          <TableSectionSelectors
            handleSelectLeftItem={(x: string) => this._selectCategory(x)}
            handleSelectRightItem={(x: string) => this._selectCategory(x, true)}
            leftItems={categoryItems}
            placeholderLeft={{ label: 'All', value: _allCategoriesKey }}
            placeholderRight={{ label: 'All', value: _allCategoriesKey }}
            rightItems={subCategoryItems}
            selectedLeftItemKey={selectedCategory}
            selectedRightItemKey={selectedSubCategory}
          />
        )}
        {isLoading && <ActivityIndicator />}
        {!isLoading && queryFrom && (
          <FlatList
            data={flatListData}
            dataTotalCount={flatListDataTotalCount}
            disableLeftSwipe={queryFrom !== _myClipsKey}
            extraData={flatListData}
            handleSearchNavigation={this._handleSearchNavigation}
            isLoadingMore={isLoadingMore}
            isRefreshing={isRefreshing}
            ItemSeparatorComponent={this._ItemSeparatorComponent}
            ListHeaderComponent={this._ListHeaderComponent}
            noSubscribedPodcasts={
              queryFrom === _subscribedKey && (!flatListData || flatListData.length === 0) && !searchBarText
            }
            onEndReached={this._onEndReached}
            onRefresh={this._onRefresh}
            renderHiddenItem={this._renderHiddenItem}
            renderItem={this._renderClipItem}
            showNoInternetConnectionMessage={showNoInternetConnectionMessage}
          />
        )}
        <ActionSheet
          handleCancelPress={this._handleCancelPress}
          items={() => {
            if (!selectedItem) return []

            if (queryFrom === _myClipsKey) {
              const loggedInUserId = safelyUnwrapNestedVariable(() => session.userInfo.id, '')
              selectedItem.ownerId = loggedInUserId
            }

            return PV.ActionSheet.media.moreButtons(
              selectedItem,
              navigation,
              this._handleCancelPress,
              this._handleDownloadPressed,
              this._handleHiddenItemPress
            )
          }}
          showModal={showActionSheet}
        />
        <Dialog.Container visible={showDeleteConfirmDialog}>
          <Dialog.Title>Delete Clip</Dialog.Title>
          <Dialog.Description>Are you sure?</Dialog.Description>
          <Dialog.Button label='Cancel' onPress={this._cancelDeleteMediaRef} />
          <Dialog.Button label='Delete' onPress={this._deleteMediaRef} />
        </Dialog.Container>
      </View>
    )
  }

  _queryData = async (
    filterKey: string | null,
    queryOptions: {
      isSubCategory?: boolean
      queryPage?: number
      searchAllFieldsText?: string
    } = {}
  ) => {
    const newState = {
      hideRightItemWhileLoading: false,
      isLoading: false,
      isLoadingMore: false,
      isRefreshing: false,
      showNoInternetConnectionMessage: false
    } as State

    const hasInternetConnection = await hasValidNetworkConnection()
    newState.showNoInternetConnectionMessage = !hasInternetConnection

    try {
      let { flatListData } = this.state
      const { queryFrom, querySort, selectedCategory, selectedSubCategory } = this.state
      const podcastId = this.global.session.userInfo.subscribedPodcastIds
      const nsfwMode = this.global.settings.nsfwMode
      const { queryPage, searchAllFieldsText } = queryOptions

      flatListData = queryOptions && queryOptions.queryPage === 1 ? [] : flatListData

      if (filterKey === _subscribedKey) {
        const results = await getMediaRefs(
          {
            sort: querySort,
            page: queryPage,
            podcastId,
            ...(searchAllFieldsText ? { searchAllFieldsText } : {}),
            subscribedOnly: true,
            includePodcast: true
          },
          this.global.settings.nsfwMode
        )
        newState.flatListData = [...flatListData, ...results[0]]
        newState.endOfResultsReached = newState.flatListData.length >= results[1]
        newState.flatListDataTotalCount = results[1]
      } else if (filterKey === _downloadedKey) {
        const downloadedEpisodeIdsObj = await getDownloadedEpisodeIds()
        const downloadedEpisodeIds = Object.keys(downloadedEpisodeIdsObj)
        const results = await getMediaRefs(
          {
            sort: querySort,
            page: queryPage,
            episodeId: downloadedEpisodeIds,
            ...(searchAllFieldsText ? { searchAllFieldsText } : {}),
            subscribedOnly: true,
            includePodcast: true
          },
          this.global.settings.nsfwMode
        )
        newState.flatListData = [...flatListData, ...results[0]]
        newState.endOfResultsReached = newState.flatListData.length >= results[1]
        newState.flatListDataTotalCount = results[1]
      } else if (filterKey === _allPodcastsKey) {
        const results = await this._queryAllMediaRefs(querySort, queryPage)
        newState.flatListData = [...flatListData, ...results[0]]
        newState.endOfResultsReached = newState.flatListData.length >= results[1]
        newState.flatListDataTotalCount = results[1]
      } else if (filterKey === _myClipsKey) {
        const results = await getLoggedInUserMediaRefs(
          {
            sort: querySort,
            page: queryPage,
            includePodcast: true
          },
          this.global.settings.nsfwMode
        )
        newState.flatListData = [...flatListData, ...results[0]]
        newState.endOfResultsReached = newState.flatListData.length >= results[1]
        newState.flatListDataTotalCount = results[1]
      } else if (filterKey === _categoryKey) {
        if (selectedCategory && selectedSubCategory === _allCategoriesKey) {
          const results = await this._queryMediaRefsByCategory(selectedCategory, querySort, queryPage)
          newState.flatListData = [...flatListData, ...results[0]]
          newState.endOfResultsReached = newState.flatListData.length >= results[1]
          newState.flatListDataTotalCount = results[1]
        } else if (selectedSubCategory) {
          const results = await this._queryMediaRefsByCategory(selectedSubCategory, querySort, queryPage)
          newState.flatListData = [...flatListData, ...results[0]]
          newState.endOfResultsReached = newState.flatListData.length >= results[1]
          newState.flatListDataTotalCount = results[1]
          newState.selectedSubCategory = selectedSubCategory || _allCategoriesKey
        } else {
          const categoryResults = await getTopLevelCategories()
          const podcastResults = await this._queryAllMediaRefs(querySort, queryPage)
          newState.categoryItems = generateCategoryItems(categoryResults[0])
          newState.flatListData = [...flatListData, ...podcastResults[0]]
          newState.endOfResultsReached = newState.flatListData.length >= podcastResults[1]
          newState.flatListDataTotalCount = podcastResults[1]
        }
      } else if (rightItems.some((option) => option.value === filterKey)) {
        const results = await getMediaRefs(
          {
            ...(queryFrom === _subscribedKey ? { podcastId } : {}),
            sort: filterKey,
            ...(searchAllFieldsText ? { searchAllFieldsText } : {}),
            subscribedOnly: queryFrom === _subscribedKey,
            includePodcast: true
          },
          nsfwMode
        )
        newState.flatListData = results[0]
        newState.endOfResultsReached = newState.flatListData.length >= results[1]
        newState.flatListDataTotalCount = results[1]
      } else {
        const { isSubCategory } = queryOptions
        let categories
        if (isSubCategory) {
          categories = filterKey === _allCategoriesKey ? selectedCategory : filterKey
        } else if (filterKey === _allCategoriesKey) {
          newState.selectedCategory = _allCategoriesKey
        } else {
          categories = filterKey
          const category = await getCategoryById(filterKey || '')
          newState.subCategoryItems = generateCategoryItems(category.categories)
          newState.selectedSubCategory = _allCategoriesKey
          newState.selectedCategory = filterKey
        }

        const results = await this._queryMediaRefsByCategory(categories, querySort, queryPage)
        newState.flatListData = results[0]
        newState.endOfResultsReached = newState.flatListData.length >= results[1]
        newState.flatListDataTotalCount = results[1]
      }

      return newState
    } catch (error) {
      return newState
    }
  }

  _queryAllMediaRefs = async (sort: string | null, page: number = 1) => {
    const { searchBarText: searchAllFieldsText } = this.state
    const results = await getMediaRefs(
      {
        sort,
        page,
        ...(searchAllFieldsText ? { searchAllFieldsText } : {}),
        includePodcast: true
      },
      this.global.settings.nsfwMode
    )

    return results
  }

  _queryMediaRefsByCategory = async (categoryId?: string | null, sort?: string | null, page: number = 1) => {
    const { searchBarText: searchAllFieldsText } = this.state
    const results = await getMediaRefs(
      {
        categories: categoryId,
        sort,
        page,
        ...(searchAllFieldsText ? { searchAllFieldsText } : {}),
        includePodcast: true
      },
      this.global.settings.nsfwMode
    )
    return results
  }
}

const _allCategoriesKey = 'allCategories'
const _allPodcastsKey = 'allPodcasts'
const _categoryKey = 'categories'
const _downloadedKey = 'downloaded'
const _myClipsKey = 'myClips'
const _subscribedKey = 'subscribed'
const _mostRecentKey = 'most-recent'
const _randomKey = 'random'
const _topPastDay = 'top-past-day'
const _topPastWeek = 'top-past-week'
const _topPastMonth = 'top-past-month'
const _topPastYear = 'top-past-year'

const leftItems = (isLoggedIn: boolean) => {
  const items = [
    {
      label: 'Subscribed',
      value: _subscribedKey
    },
    {
      label: 'Downloaded',
      value: _downloadedKey
    },
    {
      label: 'All Podcasts',
      value: _allPodcastsKey
    },
    {
      label: 'Category',
      value: _categoryKey
    }
  ]

  if (isLoggedIn) {
    items.push({
      label: 'My Clips',
      value: _myClipsKey
    })
  }

  return items
}

const rightItems = [
  {
    label: 'most recent',
    value: _mostRecentKey
  },
  {
    label: 'top - past day',
    value: _topPastDay
  },
  {
    label: 'top - past week',
    value: _topPastWeek
  },
  {
    label: 'top - past month',
    value: _topPastMonth
  },
  {
    label: 'top - past year',
    value: _topPastYear
  },
  {
    label: 'random',
    value: _randomKey
  }
]

const styles = {
  view: {
    flex: 1
  }
}
