import { PV } from '../resources'
import { request } from './request'

export const getEpisodes = async (query: any = {}, nsfwMode: boolean) => {
  const searchAllFieldsText = query.searchAllFieldsText ? encodeURIComponent(query.searchAllFieldsText) : ''
  const filteredQuery = {
    ...(query.page ? { page: query.page } : { page: 1 }),
    ...(query.sort ? { sort: query.sort } : { sort: 'top-past-week' }),
    ...(query.podcastId ? { podcastId: query.podcastId } : {}),
    ...(searchAllFieldsText ? { searchAllFieldsText } : {}),
    ...(query.includePodcast ? { includePodcast: query.includePodcast } : {}),
    ...(query.sincePubDate ? { sincePubDate: query.sincePubDate } : {})
  } as any

  if (query.categories && query.categories !== PV.Filters._allCategoriesKey) {
    filteredQuery.categories = query.categories
  }

  if (query.subscribedOnly && query.podcastId && query.podcastId.length === 0) {
    return [[], 0]
  }

  const response = await request(
    {
      endpoint: '/episode',
      query: filteredQuery
    },
    nsfwMode
  )

  return response && response.data
}

export const getEpisode = async (id: string) => {
  const response = await request({
    endpoint: `/episode/${id}`
  })

  return response && response.data
}
