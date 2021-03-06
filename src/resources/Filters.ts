import { IFilters } from './Interfaces'

/* NOTE: Filter values *have to use hyphen-case* because they are passed as
 * query param values in requests to the API, and the API expects hyphen-case.
 */

export const Filters: IFilters = {
  _subscribedKey: 'subscribed',
  _downloadedKey: 'downloaded',
  _allPodcastsKey: 'all-podcasts',
  _categoryKey: 'category',
  _alphabeticalKey: 'alphabetical',
  _mostRecentKey: 'most-recent',
  _randomKey: 'random',
  _topPastDay: 'top-past-day',
  _topPastWeek: 'top-past-week',
  _topPastMonth: 'top-past-month',
  _topPastYear: 'top-past-year',
  _chronologicalKey: 'chronological',
  _oldestKey: 'oldest',
  _myClipsKey: 'my-clips',
  _allEpisodesKey: 'all-episodes',
  _podcastsKey: 'podcasts',
  _episodesKey: 'episodes',
  _clipsKey: 'clips',
  _playlistsKey: 'playlists',
  _aboutPodcastKey: 'about-podcast',
  _showNotesKey: 'show-notes',
  _titleKey: 'title',
  _myPlaylistsKey: 'my-playlists',
  _fromThisPodcastKey: 'from-this-podcast',
  _fromThisEpisodeKey: 'from-this-episode',
  _allCategoriesKey: 'all-categories'
}
