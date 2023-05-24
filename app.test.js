const chai = require('chai');
const chaiHttp = require('chai-http');

const app = require("./app");

chai.use(chaiHttp);
const expect = chai.expect;

describe("Test shortener API", () => {
  let request;

  beforeEach(() => {
    request = chai.request(app).keepOpen();
  });

  afterEach(() => {
    request.close();
  });
  
  describe('POST /short', () => {
    it('should shorten a URL and return a short URL', async () => {
      const response = await request.post('/short').send({ url: 'https://www.example.com' });
      expect(response).to.have.status(200);
      expect(response.text).to.be.a('string');
    });
  });

  describe('GET /top-urls', () => {
    it('should return an array of top URLs', async () => {
      const response = await request.get('/top-urls');
      expect(response).to.have.status(200);
      expect(response.body).to.be.an('array');
    });
  });
});