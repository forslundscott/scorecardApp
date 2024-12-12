const {titleCase,getOrdinalNumber,exportToCSV,getHexColor,millisecondsToTimeString,addUserToDatabase,getUser,formatDate} = require('../helpers/functions')
const { Parser } = require('json2csv');
const pool = require('../db'); // Assuming this is the db module

jest.mock('../db'); // Mock the entire pool module
jest.mock('json2csv');
describe('titleCase function', () => {
    it('should capitalize the first letter of each word in string', () => {
      expect(titleCase('hello world')).toBe('Hello World');
    });
    it('should minimize any letter except the first letter of each word', () => {
        expect(titleCase('HellO worLd')).toBe('Hello World');
      });
    it('should handle empty string', () => {
      expect(titleCase('')).toBe('');
    });
  
    it('should handle invalid input gracefully', () => {
      expect(titleCase(null)).toBeUndefined();
    });
  });

  describe('getOrdinalNumber function', () => {
    it('should return "1st" for 1', () => {
      expect(getOrdinalNumber(1)).toBe('1st');
    });
  
    it('should return "2nd" for 2', () => {
      expect(getOrdinalNumber(2)).toBe('2nd');
    });

    it('should return "3rd" for 3', () => {
        expect(getOrdinalNumber(3)).toBe('3rd');
    });
    it('should return "4th" for 4', () => {
        expect(getOrdinalNumber(4)).toBe('4th');
    });
    it('should return "Invalid input" for non-integer string', () => {
      expect(getOrdinalNumber('abc')).toBe('Invalid input');
    });
  
    it('should handle negative numbers gracefully', () => {
      expect(getOrdinalNumber(-1)).toBe('Invalid input');
    });
  });

  describe('exportToCSV function', () => {
    it('should convert recordset to CSV', async () => {
      const mockRecordset = [{ id: 1, name: 'Test' }];
      const mockCsv = 'id,name\n1,Test\n';
  
      Parser.mockImplementation(() => ({
        parse: jest.fn().mockReturnValue(mockCsv),
      }));
  
      const result = await exportToCSV(mockRecordset);
      expect(result).toBe(mockCsv);
    });
  
    it('should throw an error if CSV conversion fails', async () => {
      Parser.mockImplementation(() => {
        throw new Error('Error parsing CSV');
      });
  
      await expect(exportToCSV([])).rejects.toThrow('Error parsing CSV');
    });
  });

  describe('getUser function', () => {
    it('should return user data for a valid email', async () => {
      pool.request = jest.fn().mockReturnValue({
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockResolvedValue({ recordset: [{ firstName: 'John', lastName: 'Doe' }] }),
      });
  
      const userData = { email: 'john.doe@example.com' };
      const result = await getUser(userData);
      expect(result).toEqual([{ firstName: 'John', lastName: 'Doe' }]);
    });
  
    it('should handle database errors gracefully', async () => {
      pool.request = jest.fn().mockReturnValue({
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockRejectedValue(new Error('Database error')),
      });
  
      const userData = { email: 'john.doe@example.com' };
      await expect(getUser(userData)).rejects.toThrow('Database error');
    });
  });